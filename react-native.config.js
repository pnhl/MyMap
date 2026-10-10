// Native SDK selection only; Metro includes the same shared JS for every store.
// The full Mobile Ads SDK supports devices without Google Play. Only native
// Google Sign-In is excluded from Fire builds; ads still use consent gating.
module.exports = process.env.MYMAP_STORE === 'amazon' ? {dependencies: {
 '@react-native-google-signin/google-signin': {platforms: {android: null}},
}} : {};
