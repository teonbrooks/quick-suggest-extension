/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

XPCOMUtils.defineLazyModuleGetters(this, {
  PlacesTestUtils: "resource://testing-common/PlacesTestUtils.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarProvidersManager: "resource:///modules/UrlbarProvidersManager.jsm",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.jsm",
});

// The path of the add-on file relative to `getTestFilePath`.
const ADDON_PATH = "quicksuggest.xpi";
const ABOUT_BLANK = "about:blank";

const ATTRIBUTION_URL = "http://mochi.test:8888/browser/testing/extensions/browser/qs_attribution.sjs";

// Use SIGNEDSTATE_MISSING when testing an unsigned, in-development version of
// the add-on and SIGNEDSTATE_PRIVILEGED when testing the production add-on.
const EXPECTED_ADDON_SIGNED_STATE = AddonManager.SIGNEDSTATE_MISSING;
// const EXPECTED_ADDON_SIGNED_STATE = AddonManager.SIGNEDSTATE_PRIVILEGED;

async function getAttributionHits() {
  let req = await fetch(ATTRIBUTION_URL + "?ignore=true");
  let data = await req.text();
  return parseInt(data, 10);
}

add_task(async function init() {
  await PlacesUtils.history.clear();
  await PlacesUtils.bookmarks.eraseEverything();

  await initAddonTest(ADDON_PATH, EXPECTED_ADDON_SIGNED_STATE);
});

add_task(async function basic_test() {
  await withAddon(async () => {
    await BrowserTestUtils.withNewTab(ABOUT_BLANK, async () => {
      gURLBar.focus();
      EventUtils.sendString("frab");
      EventUtils.synthesizeKey("KEY_ArrowDown");
      EventUtils.synthesizeKey("KEY_Enter");
      await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
      Assert.ok(
        /q=frabbits/.test(gBrowser.currentURI.spec),
        "Selecting first result visits suggestions URL"
      );
    });
  });
});

add_task(async function test_attribution() {

  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.topsites.useRemoteSetting", true],
      ["browser.partnerlink.attributionURL", ATTRIBUTION_URL]
    ],
  });

  Assert.equal(
    0,
    await getAttributionHits(),
    "Should have no attributions yet"
  );

  await withAddon(async () => {
    await BrowserTestUtils.withNewTab(ABOUT_BLANK, async () => {
      gURLBar.focus();
      EventUtils.sendString("frab");
      EventUtils.synthesizeKey("KEY_ArrowDown");
      EventUtils.synthesizeKey("KEY_Enter");
      await BrowserTestUtils.browserLoaded(gBrowser.selectedBrowser);
      Assert.ok(
        /q=frabbits/.test(gBrowser.currentURI.spec),
        "Selecting first result visits suggestions URL"
      );
    });
  });

  Assert.equal(
    1,
    await getAttributionHits(),
    "Search should be attributed"
  );
});
