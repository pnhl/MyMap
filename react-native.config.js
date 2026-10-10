// Native SDK selection only; Metro includes the same shared JS for every store.
// Fire ads remain disabled until an independent provider is device-tested.
module.exports = (process.env.APP_STORE_TARGET || process.env.MYMAP_STORE) === 'amazon' ? {dependencies: {
 '@react-native-google-signin/google-signin': {platforms: {android: null}},
 'react-native-google-mobile-ads': {platforms: {android: null}},
}} : {};
