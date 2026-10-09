// Native SDK selection only; Metro includes the same shared JS for every store.
module.exports = process.env.MYMAP_STORE === 'amazon' ? {dependencies: {
 '@react-native-google-signin/google-signin': {platforms: {android: null}},
 'react-native-google-mobile-ads': {platforms: {android: null}},
}} : {};
