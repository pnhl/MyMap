package expo.modules.mymapcapabilities
/** Resolve Google classes only after this boundary; linkage failures are a capability result. */
internal object GoogleServicesGate {
 fun available(check:()->Int):Boolean=try{check()==0}catch(_:Exception){false}catch(_:LinkageError){false}
}
