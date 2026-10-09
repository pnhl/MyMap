package com.pnhl.vibecoding;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.TimeUnit;

// Use the public Firebase Auth API through reflection to keep its Kotlin 2.3
// metadata outside Expo Kotlin 2.1 source analysis. R8 preserves only these APIs.
public class MomentWidgetWorker extends Worker {
 private final Context app;
 public MomentWidgetWorker(@NonNull Context app,@NonNull WorkerParameters params){super(app,params);this.app=app;}
 private String post(String base,String path,JSONObject body,String token,String key)throws Exception{
  HttpURLConnection conn=(HttpURLConnection)new URL(base+path).openConnection();
  conn.setRequestMethod("POST");conn.setConnectTimeout(12000);conn.setReadTimeout(12000);conn.setDoOutput(true);conn.setInstanceFollowRedirects(false);
  conn.setRequestProperty("Authorization","Bearer "+token);conn.setRequestProperty("apikey",key);conn.setRequestProperty("Content-Type","application/json");
  try{
   try(OutputStream out=conn.getOutputStream()){out.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
   if(conn.getResponseCode()<200||conn.getResponseCode()>=300)throw new IOException("Widget request "+conn.getResponseCode());
   try(InputStream in=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] buf=new byte[8192];int n,total=0;while((n=in.read(buf))!=-1){total+=n;if(total>1048576)throw new IOException("Oversize response");out.write(buf,0,n);}return out.toString("UTF-8");
   }
  }finally{conn.disconnect();}
 }
 @NonNull @Override public Result doWork(){
  SharedPreferences prefs=MomentWidget.Companion.prefs(app);String raw=prefs.getString("config","{}");File pending=new File(app.getFilesDir(),"moment-widget-cover-pending.jpg");
  try{
   JSONObject config=new JSONObject(raw);
   if(!"friends".equals(config.optString("mode"))){MomentWidget.Companion.render(app);return Result.success();}
   Class<?> authClass=Class.forName("com.google.firebase.auth.FirebaseAuth"),userClass=Class.forName("com.google.firebase.auth.FirebaseUser");
   Object auth=authClass.getMethod("getInstance").invoke(null),user=authClass.getMethod("getCurrentUser").invoke(auth);
   String uid=user==null?null:(String)userClass.getMethod("getUid").invoke(user);
   if(user==null||!uid.equals(config.optString("account"))||(Boolean)userClass.getMethod("isAnonymous").invoke(user)){MomentWidget.Companion.clear(app);return Result.success();}
   String base=config.optString("url");if(!base.equals("https://uwlxysystowwnfvdmfzo.supabase.co"))return Result.failure();
   Object task=userClass.getMethod("getIdToken",boolean.class).invoke(user,false);
   Object tokenResult=Class.forName("com.google.android.gms.tasks.Tasks").getMethod("await",Class.forName("com.google.android.gms.tasks.Task"),long.class,TimeUnit.class).invoke(null,task,15L,TimeUnit.SECONDS);
   String token=(String)Class.forName("com.google.firebase.auth.GetTokenResult").getMethod("getToken").invoke(tokenResult),key=config.getString("key");
   if(token==null)return Result.retry();
   String owner=post(base,"/rest/v1/rpc/mm_identity",new JSONObject(),token,key).trim().replace("\"","");
   String author=config.optString("author"),group=config.optString("group");
   JSONObject query=new JSONObject().put("p_limit",30).put("p_author",author.isEmpty()?JSONObject.NULL:author).put("p_group",group.isEmpty()?JSONObject.NULL:group);
   JSONArray feed=new JSONArray(post(base,"/rest/v1/rpc/mm_feed",query,token,key));JSONObject item=null;
   for(int i=0;i<feed.length();i++){JSONObject candidate=feed.getJSONObject(i);if(!group.isEmpty()||!owner.equals(candidate.optString("owner_id"))){item=candidate;break;}}
   if(item==null){MomentWidget.Companion.clear(app);return Result.success();}
   String path=Uri.encode(item.getString("cover_path"),"/");
   String signed=new JSONObject(post(base,"/storage/v1/object/sign/mymap-moments/"+path,new JSONObject().put("expiresIn",120),token,key)).getString("signedURL");
   if(!signed.startsWith("/object/sign/mymap-moments/"))throw new IOException("Unexpected image URL");
   HttpURLConnection download=(HttpURLConnection)new URL(base+"/storage/v1"+signed).openConnection();download.setConnectTimeout(12000);download.setReadTimeout(12000);download.setInstanceFollowRedirects(false);
   try{
    if(download.getResponseCode()!=200)throw new IOException("Image unavailable");
    try(InputStream in=download.getInputStream();OutputStream out=new FileOutputStream(pending)){
     byte[] buf=new byte[16384];int n,total=0;while((n=in.read(buf))!=-1){total+=n;if(total>26214400)throw new IOException("Oversize image");out.write(buf,0,n);}
    }
   }finally{download.disconnect();}
   Object current=authClass.getMethod("getCurrentUser").invoke(auth);
   if(current==null||!uid.equals(userClass.getMethod("getUid").invoke(current))||!raw.equals(prefs.getString("config","{}"))){pending.delete();return Result.success();}
   File target=new File(app.getFilesDir(),"moment-widget-cover.jpg");if(!pending.renameTo(target)){pending.delete();return Result.retry();}
   String caption=item.optString("caption");
   JSONObject snapshot=new JSONObject().put("id",item.getString("id")).put("image",Uri.fromFile(target).toString()).put("caption",caption.isEmpty()?"Một khoảnh khắc mới":caption).put("author",item.optString("author_name","MyMap"));
   prefs.edit().putString("snapshot",snapshot.toString()).apply();MomentWidget.Companion.render(app);return Result.success();
  }catch(Exception error){pending.delete();return getRunAttemptCount()<2?Result.retry():Result.failure();}
 }
}
