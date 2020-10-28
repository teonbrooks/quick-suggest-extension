/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

import KeywordTree from "./KeywordTree.js";

Cu.importGlobalProperties(["fetch"]);

const SUGGESTIONS_PATH = "data/suggestions.json";
const ICON_PATH = "icons/favicon.ico";

class KeywordTreeProvider {
  constructor() {
    this.tree = new KeywordTree();
    this.results = new Map();
    this.iconPath = null;
    this.title = "";
  }

  async load(root) {
    let url = root.resolve(SUGGESTIONS_PATH);
    let data = await KeywordTreeProvider.fetchJSON(url);
    this.title = data.title;
    this.results = data.records;
    this.tree.fromJSON(data.tree);
    this.iconPath = root.resolve(ICON_PATH);
  }

  async query(phrase) {
    let index = this.tree.get(phrase);
    if (!index || !(index in this.results)) {
      return null;
    }
    let result = this.results[index];
    return {
      title: this.title.replace("%s", result.term),
      url: result.url,
      icon: this.iconPath
    };
  }

  static async fetchJSON(url) {
    let req = await fetch(url);
    return req.json();
  }
}

export default KeywordTreeProvider;
