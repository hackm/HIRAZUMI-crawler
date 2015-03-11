/*jslint node: true */
'use strict';
/**
 * Module dependencies
 */
var async = require('async'),
  client = require('cheerio-httpcli'),
  fs = require('fs'),
  temporal = require('temporal'),
  model = require('../model');

var queryListName = './query.txt';

var Qiita = {};

Qiita.host = 'http://qiita.com';
Qiita.searchDir = '/search';
Qiita.model = model.Qiita;

Qiita.fetch = function(query) {
  var page = 1;
  // fetch loop every 500ms
  temporal.loop(500, function() {
    if (Qiita.fetchList(page++, query) < 10)
      this.stop();
  });
};

/**
 * fetch from Qiita user article list based on the query
 */
Qiita.fetchList = function(page, query) {
  client.fetch(Qiita.host + Qiita.searchDir, {
    page: page,
    q: query,
    sort: 'rel',
    utf8: '%E2%9C%93'
  }).then(function(result) {
    var articleSize = result.$('.searchResult').length;

    if (!articleSize)
      return 0;

    result.$('.searchResult_itemTitle > a').each(function() {
      Qiita.fetchArticle(result.$(this).attr('href'));
    });

    return articleSize;
  });
};

/**
 * fetch from Qiita user article
 */
Qiita.fetchArticle = function(articlePath) {
  client.fetch(Qiita.host + articlePath)
    .then(function(result) {
      if (result.err) {
        console.log(result.err);
      } else {
        var $article = result.$('[itemprop=articleBody]'),
          flg = false,
          anchor_tmp = '',
          isbn = [],
          json = {};

        $article.find('a').each(function() {
          anchor_tmp = result.$(this).attr('href');
          if (anchor_tmp && anchor_tmp.match(/www\.amazon/)) {
            isbn.push(anchor_tmp.replace(/^.+\/(\d{10})\/.*$/, "$1"));
            flg = true;
          }
        });

        if (flg) {
          json = JSON.stringify({
            title: result.$('.itemsShowHeaderTitle_title').text(),
            url: Qiita.host + articlePath,
            isbn: isbn
          });
          Qiita.save(json);
        }
      }
    });
};

Qiita.save = function(json) {
  var qiita = new Qiita.model();
  qiita = json;
  qiita.save();
};

/**
 * expect exsit file ./qiita/query.txt
 * node ./qiita.js
 */
// module.exports = Qiita;
async.forEachSeries(
  fs.readFileSync(queryListName).toString().split('\n'),
  function(line, callback) {
    if (line)
      Qiita.fetch(line);
    callback();
  }
);
