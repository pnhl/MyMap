package com.pnhl.vibecoding

import android.app.Presentation
import android.content.Context
import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.annotation.SuppressLint
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.car.app.*
import androidx.car.app.validation.HostValidator
import androidx.car.app.model.*
import androidx.car.app.navigation.NavigationManager
import androidx.car.app.navigation.NavigationManagerCallback
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.car.app.navigation.model.MessageInfo
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import org.json.JSONObject
import org.maplibre.android.MapLibre
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.PropertyFactory.*

class MyMapCarService:CarAppService(){
 override fun createHostValidator():HostValidator = if(BuildConfig.DEBUG)HostValidator.ALLOW_ALL_HOSTS_VALIDATOR else HostValidator.Builder(this).addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample).build()
 override fun onCreateSession():Session=object:Session(){override fun onCreateScreen(intent:Intent):Screen=MyMapCarScreen(carContext)}
}

/** Dedicated driving template. Native ads, friends, chat and phone UI are not projected. */
private class MyMapCarScreen(context:CarContext):Screen(context),SurfaceCallback,DefaultLifecycleObserver,LocationListener{
 private val handler=Handler(Looper.getMainLooper())
 private val prefs=context.getSharedPreferences("mymap_travel",Context.MODE_PRIVATE)
 private var presentation:Presentation?=null
 private var display:VirtualDisplay?=null
 private var mapView:MapView?=null
 private var map:MapLibreMap?=null
 private var state=JSONObject()
 private var started=false
 private var surfaceWidth=0
 private var surfaceHeight=0
 private var phoneUpdate=0L
 private var position:Location?=null
 private val locations=context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
 private val poll=object:Runnable {override fun run(){
  val phoneState=runCatching{JSONObject(prefs.getString("car_state","{}")?:"{}")} .getOrDefault(JSONObject())
  if(phoneState.optLong("updatedAt")!=phoneUpdate){phoneUpdate=phoneState.optLong("updatedAt");state=phoneState}
  if(System.currentTimeMillis()-phoneUpdate>24*60*60*1000)state.put("active",false)
  position?.let{p->state.put("position",JSONObject().put("latitude",p.latitude).put("longitude",p.longitude));updateGuidance(p)}
  val active=state.optBoolean("active",false)
  if(active&&!started){carContext.getCarService(NavigationManager::class.java).navigationStarted();started=true}
  else if(!active&&started){carContext.getCarService(NavigationManager::class.java).navigationEnded();started=false}
  updateMap();invalidate();handler.postDelayed(this,2000)
 }}
 init{lifecycle.addObserver(this);carContext.getCarService(AppManager::class.java).setSurfaceCallback(this)
  carContext.getCarService(NavigationManager::class.java).setNavigationManagerCallback(androidx.core.content.ContextCompat.getMainExecutor(carContext),object:NavigationManagerCallback{override fun onStopNavigation(){state.put("active",false);prefs.edit().putString("car_state",state.toString()).apply();started=false;TravelPlatformModule.stopCarNavigation();invalidate()}})
 }
 @SuppressLint("MissingPermission")
 override fun onStart(owner:LifecycleOwner){
  if(androidx.core.content.ContextCompat.checkSelfPermission(carContext,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED){
   listOf(LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER).forEach{provider->runCatching{if(locations.isProviderEnabled(provider))locations.requestLocationUpdates(provider,1500,2f,this,Looper.getMainLooper())}}
  }
  handler.post(poll)
 }
 override fun onStop(owner:LifecycleOwner){handler.removeCallbacks(poll);locations.removeUpdates(this)}
 override fun onDestroy(owner:LifecycleOwner){handler.removeCallbacksAndMessages(null);locations.removeUpdates(this);releaseSurface();carContext.getCarService(AppManager::class.java).setSurfaceCallback(null)}
 override fun onGetTemplate():Template{
  val guidance=state.optJSONObject("guidance")
  val active=state.optBoolean("active",false)
  val instruction=if(active)guidance?.optString("instruction")?.takeIf{it.isNotBlank()}?:"Follow the route" else "Choose a destination in MyMap on your phone"
  val distance=guidance?.optDouble("distanceMeters",Double.NaN)
  val title=if(active&&distance!=null&&distance.isFinite())"${distance.toInt()} m · $instruction" else instruction
  val subtitle=if(active)state.optString("destination","MyMap") else "MyMap · OpenFreeMap / OpenStreetMap"
  val actions=ActionStrip.Builder().addAction(Action.Builder().setTitle("MyMap").setOnClickListener{invalidate();updateMap()}.build()).build()
  return NavigationTemplate.Builder().setNavigationInfo(MessageInfo.Builder(title).setText(subtitle).build()).setActionStrip(actions).build()
 }
 override fun onSurfaceAvailable(surface:SurfaceContainer){
  releaseSurface();if(surface.width<=0||surface.height<=0)return
  surfaceWidth=surface.width;surfaceHeight=surface.height
  MapLibre.getInstance(carContext)
  val manager=carContext.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
  display=manager.createVirtualDisplay("MyMap Auto map",surface.width,surface.height,surface.dpi.coerceAtLeast(160),surface.surface,DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY)
  val d=display?:return
  presentation=object:Presentation(carContext,d.display){override fun onCreate(saved:Bundle?){super.onCreate(saved)
   val view=MapView(context);mapView=view;setContentView(view);view.onCreate(null);view.onStart();view.onResume()
   view.getMapAsync{m->map=m;m.uiSettings.isLogoEnabled=false;m.uiSettings.isAttributionEnabled=true
    m.setStyle("https://tiles.openfreemap.org/styles/liberty"){style->style.addSource(GeoJsonSource("mymap-route","{\"type\":\"FeatureCollection\",\"features\":[]}"));style.addLayer(LineLayer("mymap-route-line","mymap-route").withProperties(lineColor("#4464F6"),lineWidth(7f)));updateMap()}
   }
  }};presentation?.show()
 }
 override fun onVisibleAreaChanged(rect:Rect){map?.setPadding(rect.left,rect.top,(surfaceWidth-rect.right).coerceAtLeast(0),(surfaceHeight-rect.bottom).coerceAtLeast(0))}
 override fun onStableAreaChanged(rect:Rect){}
 override fun onSurfaceDestroyed(surface:SurfaceContainer){releaseSurface()}
 override fun onLocationChanged(location:Location){if(location.hasAccuracy()&&location.accuracy<=80){position=Location(location);updateGuidance(location);updateMap()}}
 private fun updateGuidance(p:Location){
  val steps=state.optJSONArray("steps")?:return
  if(steps.length()==0)return
  var closest=Double.POSITIVE_INFINITY;var index=-1
  fun distance(step:JSONObject):Double{val point=step.optJSONArray("position")?:return Double.POSITIVE_INFINITY;val result=FloatArray(1);Location.distanceBetween(p.latitude,p.longitude,point.optDouble(0),point.optDouble(1),result);return result[0].toDouble()}
  for(i in 0 until steps.length()){val step=steps.optJSONObject(i)?:continue;val d=distance(step);if(d<closest){closest=d;index=i}}
  if(index<0)return
  if(index==0||closest<25)index=(index+1).coerceAtMost(steps.length()-1)
  val next=JSONObject(steps.getJSONObject(index).toString());val nextDistance=distance(next);if(nextDistance.isFinite()){next.put("distanceMeters",nextDistance.toInt());state.put("guidance",next)}
 }
 private fun updateMap(){
  val m=map?:return
  val p=state.optJSONObject("position")
  if(p!=null&&p.has("latitude")&&p.has("longitude"))m.cameraPosition=CameraPosition.Builder().target(LatLng(p.getDouble("latitude"),p.getDouble("longitude"))).zoom(if(state.optBoolean("active"))15.0 else 13.0).build()
  val points=state.optJSONArray("coordinates")
  val coordinates=org.json.JSONArray()
  if(points!=null)for(i in 0 until points.length()){val pair=points.optJSONArray(i)?:continue;coordinates.put(org.json.JSONArray().put(pair.optDouble(1)).put(pair.optDouble(0)))}
  val geo=if(coordinates.length()>1)JSONObject().put("type","Feature").put("properties",JSONObject()).put("geometry",JSONObject().put("type","LineString").put("coordinates",coordinates)).toString() else "{\"type\":\"FeatureCollection\",\"features\":[]}"
  m.style?.getSourceAs<GeoJsonSource>("mymap-route")?.setGeoJson(geo)
 }
 private fun releaseSurface(){map=null;mapView?.let{it.onPause();it.onStop();it.onDestroy()};mapView=null;presentation?.dismiss();presentation=null;display?.release();display=null}
}
