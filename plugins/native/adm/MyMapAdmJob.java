package com.pnhl.vibecoding;
import android.content.Context;
import android.content.Intent;
import com.amazon.device.messaging.ADMMessageHandlerJobBase;
public final class MyMapAdmJob extends ADMMessageHandlerJobBase {
 @Override protected void onRegistered(Context context,String token){MyMapAdmDelivery.registered(context,token);}
 @Override protected void onUnregistered(Context context,String token){MyMapAdmDelivery.registered(context,null);}
 @Override protected void onRegistrationError(Context context,String error){MyMapAdmDelivery.registered(context,null);}
 @Override protected void onMessage(Context context,Intent intent){MyMapAdmDelivery.message(context,intent);}
}
