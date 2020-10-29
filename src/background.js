/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/* import-globals-from shim.js */

const BRANCHES = {
  CONTROL: "control",
  TREATMENT: "treatment",
};

const URLBAR_PROVIDER_NAME = "ProviderDynamicPalmTree";

let api = browser.experiments.urlbar;
let testProvider = null;

// Our provider.
class ProviderDynamicPalmTree extends UrlbarProvider {
  constructor() {
    super();
    this._resultReturned = false;
    // Store the result from the urlbar provider so we can
    // share between isActive and startQuery.
    this.matchedResult = null;
  }

  get name() {
    return URLBAR_PROVIDER_NAME;
  }

  getPriority(queryContext) {
    return 0;
  }

  async isActive(queryContext) {
    this.matchedResult = await api.matchSearchTerm(queryContext.searchString);
    return !!this.matchedResult;
  }

  async startQuery(queryContext, addCallback) {
    if (!this.matchedResult) {
      return;
    }
    let result = new UrlbarResult(
      UrlbarUtils.RESULT_TYPE.URL,
      UrlbarUtils.RESULT_SOURCE.OTHER_NETWORK,
      this.matchedResult
    );
    result.suggestedIndex = 1;
    addCallback(this, result);
    this._resultReturned = true;
  }

  cancelQuery(queryContext) {}

  handleEngagement(state) {
    if (state == "start") {
      this._resultReturned = false;
      return;
    }

    if (["engagement", "abandonment"].includes(state) && this._resultReturned) {
      browser.telemetry.keyedScalarAdd(
        "browser.search.experiments.impressions",
        URLBAR_PROVIDER_NAME,
        1
      );
    }

    if (state === "engagement") {
      api.resultVisited(this.matchedResult.url);
    }
  }
}

/**
 * Logs a debug message, which the test harness interprets as a message the
 * add-on is sending to the test.  See head.js for info.
 *
 * @param {string} msg
 *   The message.
 */
function sendTestMessage(msg) {
  console.debug(browser.runtime.id, msg);
}

/**
 * Resets all the state we set on enrollment in the study.
 *
 * @param {bool} isTreatmentBranch
 *   True if we were enrolled on the treatment branch, false if control.
 */
async function unenroll(isTreatmentBranch) {
  await browser.urlbar.engagementTelemetry.clear({});
  if (isTreatmentBranch) {
    testProvider.removeListeners();
  }
  sendTestMessage("unenrolled");
}

/**
 * Sets up all appropriate state for enrollment in the study.
 *
 * @param {bool} isTreatmentBranch
 *   True if we are enrolling on the treatment branch, false if control.
 */
async function enroll(isTreatmentBranch) {
  await browser.normandyAddonStudy.onUnenroll.addListener(async () => {
    await unenroll(isTreatmentBranch);
  });

  // Enable urlbar engagement event telemetry.  See bugs 1559136 and 1570683.
  await browser.urlbar.engagementTelemetry.set({ value: true });

  if (isTreatmentBranch) {
    // Add our specific scalars.
    await browser.telemetry.registerScalars("browser.search.experiments", {
      impressions: {
        keyed: true,
        kind: browser.telemetry.ScalarType.COUNT,
        record_on_release: true,
      },
    });

    // Enable our provider.
    testProvider = new ProviderDynamicPalmTree();
  }

  sendTestMessage("enrolled");
}

(async function main() {
  // As a development convenience, act like we're enrolled in the treatment
  // branch if we're a temporary add-on.  onInstalled with details.temporary =
  // true will be fired in that case.  Add the listener now before awaiting the
  // study below to make sure we don't miss the event.
  let installPromise = new Promise(resolve => {
    browser.runtime.onInstalled.addListener(details => {
      resolve(details.temporary);
    });
  });

  // If we're enrolled in the study, set everything up, and then we're done.
  let study = await browser.normandyAddonStudy.getStudy();
  if (study) {
    // Sanity check the study.  This conditional should always be true.
    if (study.active && Object.values(BRANCHES).includes(study.branch)) {
      await enroll(study.branch == BRANCHES.TREATMENT);
    }
    sendTestMessage("ready");
    return;
  }

  // There's no study.  If installation happens, then continue with the
  // development convenience described above.
  installPromise.then(async isTemporaryInstall => {
    if (isTemporaryInstall) {
      console.debug("isTemporaryInstall");
      await enroll(true);
    }
    sendTestMessage("ready");
  });
})();
