package com.pnhl.vibecoding;
import android.content.Intent;
import com.amazon.device.messaging.ADMMessageHandlerBase;
public final class MyMapAdmLegacy extends ADMMessageHandlerBase {
 public MyMapAdmLegacy(){super("MyMapADM");}
 @Override protected void onRegistered(String token){MyMapAdmDelivery.registered(this,token);}
 @Override protected void onUnregistered(String token){MyMapAdmDelivery.registered(this,null);}
 @Override protected void onRegistrationError(String error){MyMapAdmDelivery.registered(this,null);}
 @Override protected void onMessage(Intent intent){MyMapAdmDelivery.message(this,intent);}
}
