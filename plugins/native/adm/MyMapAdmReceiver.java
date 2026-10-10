package com.pnhl.vibecoding;
import com.amazon.device.messaging.ADMMessageReceiver;
public final class MyMapAdmReceiver extends ADMMessageReceiver {
 public MyMapAdmReceiver(){super(MyMapAdmLegacy.class);try{Class.forName("com.amazon.device.messaging.ADMMessageHandlerJobBase");registerJobServiceClass(MyMapAdmJob.class,2145);}catch(ClassNotFoundException ignored){}}
}
