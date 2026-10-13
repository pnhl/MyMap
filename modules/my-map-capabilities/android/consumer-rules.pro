# The no-GMS boundary resolves these exact class/member names reflectively.
# Without this rule R8 renames getInstance/isGooglePlayServicesAvailable and
# Release incorrectly hides Google sign-in, ads and the Nano capability.
-keep class com.google.android.gms.common.GoogleApiAvailability {
    public static com.google.android.gms.common.GoogleApiAvailability getInstance();
    public int isGooglePlayServicesAvailable(android.content.Context);
}
