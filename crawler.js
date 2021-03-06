/**
 * Module dependencies.
 */
var fs = require('fs'),
  async = require('async'),
  client = require('cheerio-httpcli'),
  readline = require('readline');

var sleep = function(milliSeconds) {
  var startTime = new Date().getTime();
  while (new Date().getTime() < startTime + milliSeconds) {}
};

var filter_text = function($) {
  if ($) {
    return $.text();
  }
  return '';
};

var filter_str = function(str) {
  if (str) {
    return str;
  }
  return '';
};

var filter_number = function(str) {
  if (isFinite(str)) {
    return str;
  }
  return -1;
};

var filter_size = function(size) {
  if (size.match(/([\d\.x]+cm)/)) {
    return size;
  }
  return '';
};

var filter_price = function(str) {
  if (str) {
    return str.replace(/\s|\\|,|￥/g, '');
  }
  return -1;
};

var htmlUnescape = function(html) {
  html = html.replace(/</g, '&amp;lt;').replace(/>/g, '&amp;gt;');
  html = html.replace(/\"/g, '&amp;quot;').replace(/\'/g, '&amp;#39;');
  var div = document.createElement('div');
  div.innerHTML = '<pre>' + html + '</pre>';
  return div.textContent !== undefined ? div.textContent : div.innerText;
};

var escape = function(str) {
  return str.replace(/"/g, '\\"').replace(/\s/g, '');
};


var fetchCalilList = function(page) {
  // 入門
  // var baseUrl = 'https://calil.jp/category?c=%E3%82%B3%E3%83%B3%E3%83%94%E3%83%A5%E3%83%BC%E3%82%BF&sc=%E4%B8%80%E8%88%AC%E3%83%BB%E5%85%A5%E9%96%80%E6%9B%B8&page=1';
  // プログラミング
  // var baseUrl = 'https://calil.jp/category?c=%E3%82%B3%E3%83%B3%E3%83%94%E3%83%A5%E3%83%BC%E3%82%BF&sc=%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%9F%E3%83%B3%E3%82%B0';
  // モバイル
  // var baseUrl = 'https://calil.jp/category?c=%E3%82%B3%E3%83%B3%E3%83%94%E3%83%A5%E3%83%BC%E3%82%BF&sc=%E3%83%A2%E3%83%90%E3%82%A4%E3%83%AB%E3%83%BBi%E3%83%A2%E3%83%BC%E3%83%89';
  // web
  var baseUrl = 'https://calil.jp/category?c=%E3%82%B3%E3%83%B3%E3%83%94%E3%83%A5%E3%83%BC%E3%82%BF&sc=%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%8D%E3%83%83%E3%83%88%E3%83%BBWeb%E9%96%8B%E7%99%BA';
  console.log(page);

  client.fetch(baseUrl, {
    page: page
  }, function(err, $, res) {
    var $article = $('.thumb_cage'),
      articleSize = $article.length;

    if (articleSize <= 0) {
      return;
    }
    $article.each(function() {
      url = $(this).children('a').attr('href');
      fs.appendFile('./calil/url.txt', url + "\n");
    });
    if (10 <= articleSize)
      fetchCalilList(++page);
  });
};

// fetchCalilList(1);

var fetchCalil = function() {
  var baseUrl = 'https://calil.jp',
    rs = fs.ReadStream('./calil/url.txt'),
    rl = readline.createInterface({
      'input': rs,
      'output': {}
    });

  async.forEachSeries(
    fs.readFileSync('./qiita/url.txt').toString().split('\n'),
    function(line, callback) {
      client.fetch(baseUrl + line.trim(), {}, function(err, $, res) {
        if (err) {
          console.log(err);
        } else {
          var description = $('[itemprop=description]').text().replace(/\s/g, ''),
            data,
            isbn = line.trim().slice(6),
            amazonUrl = $('a.amazon_detail').attr('href'),
            descriptionData;

          data = '{"title":"' + filter_text($('.book_title')).replace(/\s/g, '') +
            '","author":"' + filter_text($('.book_authors a:first')) +
            '","publisher":"' + filter_text($('[itemprop=publisher]')) +
            '","date":"' + filter_text($('[itemprop=datePublished]')).slice(1, -1) +
            '","isbn":"' + isbn +
            '","page":' + filter_number(description.replace(/.+:(\d+)ページ.+/, "$1")) +
            ',"size":"' + filter_size(description.replace(/.+\/([\d\.x]+cm)ISBN.+/, "$1")) +
            '","shopUrl":"' + filter_str(amazonUrl) +
            '","imageUrl":"' + $('.largeimage').attr('src');
          if (amazonUrl) {
            client.fetch(amazonUrl, {}, function(err, $, res) {
              if (err) {
                console.log(err);
              } else {
                data += '","yen":' +
                  filter_price($('span.a-size-medium.a-color-price.offer-price.a-text-normal').text());
                client.fetch('http://www.amazon.co.jp/gp/aw/d/' + isbn + '/ref=mw_dp_mpd?er=1', {}, function(err, $, res) {
                  if (err) {
                    console.log(err);
                  } else {
                    descriptionData = $('table[color=#000000]+font').first().text();
                    data += ',"description":"' + escape(htmlUnescape(descriptionData)).slice(4) +
                      '"},';
                    fs.appendFile('./calil/book.json', data);
                    sleep(1000);
                    callback();
                  }
                });
              }
            });
          } else {
            sleep(1000);
            callback();
          }
        }
      });
    });
  rl.resume();
};

// fetchCalil();
