export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.log("Webchain extension installed");
  });
});
