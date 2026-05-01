import {
  __commonJS,
  __require,
  __toESM
} from "./chunk-2EL6F67R.js";

// node_modules/jiti/dist/jiti.cjs
var require_jiti = __commonJS({
  "node_modules/jiti/dist/jiti.cjs"(exports, module) {
    (() => {
      var e = { "./node_modules/.pnpm/mlly@1.8.0/node_modules/mlly/dist lazy recursive": function(e2) {
        function webpackEmptyAsyncContext(e3) {
          return Promise.resolve().then(function() {
            var t2 = new Error("Cannot find module '" + e3 + "'");
            throw t2.code = "MODULE_NOT_FOUND", t2;
          });
        }
        webpackEmptyAsyncContext.keys = () => [], webpackEmptyAsyncContext.resolve = webpackEmptyAsyncContext, webpackEmptyAsyncContext.id = "./node_modules/.pnpm/mlly@1.8.0/node_modules/mlly/dist lazy recursive", e2.exports = webpackEmptyAsyncContext;
      } }, t = {};
      function __webpack_require__(i2) {
        var s = t[i2];
        if (void 0 !== s) return s.exports;
        var r = t[i2] = { exports: {} };
        return e[i2](r, r.exports, __webpack_require__), r.exports;
      }
      __webpack_require__.n = (e2) => {
        var t2 = e2 && e2.__esModule ? () => e2.default : () => e2;
        return __webpack_require__.d(t2, { a: t2 }), t2;
      }, __webpack_require__.d = (e2, t2) => {
        for (var i2 in t2) __webpack_require__.o(t2, i2) && !__webpack_require__.o(e2, i2) && Object.defineProperty(e2, i2, { enumerable: true, get: t2[i2] });
      }, __webpack_require__.o = (e2, t2) => Object.prototype.hasOwnProperty.call(e2, t2);
      var i = {};
      (() => {
        "use strict";
        __webpack_require__.d(i, { default: () => createJiti2 });
        const e2 = __require("os");
        var t2 = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 7, 9, 32, 4, 318, 1, 80, 3, 71, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 68, 8, 2, 0, 3, 0, 2, 3, 2, 4, 2, 0, 15, 1, 83, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 7, 19, 58, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 343, 9, 54, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14, 10, 5350, 0, 7, 14, 11465, 27, 2343, 9, 87, 9, 39, 4, 60, 6, 26, 9, 535, 9, 470, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4178, 9, 519, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357, 0, 62, 13, 499, 13, 245, 1, 2, 9, 726, 6, 110, 6, 6, 9, 4759, 9, 787719, 239], s = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 4, 51, 13, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 39, 27, 10, 22, 251, 41, 7, 1, 17, 2, 60, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 31, 9, 2, 0, 3, 0, 2, 37, 2, 0, 26, 0, 2, 0, 45, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 200, 32, 32, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 16, 0, 2, 12, 2, 33, 125, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1071, 18, 5, 26, 3994, 6, 582, 6842, 29, 1763, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 433, 44, 212, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 42, 9, 8936, 3, 2, 6, 2, 1, 2, 290, 16, 0, 30, 2, 3, 0, 15, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 7, 5, 262, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27, 229, 29, 3, 0, 496, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4153, 7, 221, 3, 5761, 15, 7472, 16, 621, 2467, 541, 1507, 4938, 6, 4191], r = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0560-\u0588\u05D0-\u05EA\u05EF-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u0870-\u0887\u0889-\u088E\u08A0-\u08C9\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C5D\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D04-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E86-\u0E8A\u0E8C-\u0EA3\u0EA5\u0EA7-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u1711\u171F-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1878\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4C\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C8A\u1C90-\u1CBA\u1CBD-\u1CBF\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1CFA\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312F\u3131-\u318E\u31A0-\u31BF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7CD\uA7D0\uA7D1\uA7D3\uA7D5-\uA7DC\uA7F2-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA8FE\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB69\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC", n = { 3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile", 5: "class enum extends super const export import", 6: "enum", strict: "implements interface let package private protected public static yield", strictBind: "eval arguments" }, a = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this", o = { 5: a, "5module": a + " export import", 6: a + " const class extends export import super" }, h = /^in(stanceof)?$/, c = new RegExp("[" + r + "]"), p = new RegExp("[" + r + "\u200C\u200D\xB7\u0300-\u036F\u0387\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0897-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0CF3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1369-\u1371\u1712-\u1715\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u180F-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19D0-\u19DA\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1ABF-\u1ACE\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u200C\u200D\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\u30FB\uA620-\uA629\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880\uA881\uA8B4-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F1\uA8FF-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F\uFF65]");
        function isInAstralSet(e3, t3) {
          for (var i2 = 65536, s2 = 0; s2 < t3.length; s2 += 2) {
            if ((i2 += t3[s2]) > e3) return false;
            if ((i2 += t3[s2 + 1]) >= e3) return true;
          }
          return false;
        }
        function isIdentifierStart(e3, t3) {
          return e3 < 65 ? 36 === e3 : e3 < 91 || (e3 < 97 ? 95 === e3 : e3 < 123 || (e3 <= 65535 ? e3 >= 170 && c.test(String.fromCharCode(e3)) : false !== t3 && isInAstralSet(e3, s)));
        }
        function isIdentifierChar(e3, i2) {
          return e3 < 48 ? 36 === e3 : e3 < 58 || !(e3 < 65) && (e3 < 91 || (e3 < 97 ? 95 === e3 : e3 < 123 || (e3 <= 65535 ? e3 >= 170 && p.test(String.fromCharCode(e3)) : false !== i2 && (isInAstralSet(e3, s) || isInAstralSet(e3, t2)))));
        }
        var acorn_TokenType = function(e3, t3) {
          void 0 === t3 && (t3 = {}), this.label = e3, this.keyword = t3.keyword, this.beforeExpr = !!t3.beforeExpr, this.startsExpr = !!t3.startsExpr, this.isLoop = !!t3.isLoop, this.isAssign = !!t3.isAssign, this.prefix = !!t3.prefix, this.postfix = !!t3.postfix, this.binop = t3.binop || null, this.updateContext = null;
        };
        function binop(e3, t3) {
          return new acorn_TokenType(e3, { beforeExpr: true, binop: t3 });
        }
        var l = { beforeExpr: true }, u = { startsExpr: true }, d = {};
        function kw(e3, t3) {
          return void 0 === t3 && (t3 = {}), t3.keyword = e3, d[e3] = new acorn_TokenType(e3, t3);
        }
        var f = { num: new acorn_TokenType("num", u), regexp: new acorn_TokenType("regexp", u), string: new acorn_TokenType("string", u), name: new acorn_TokenType("name", u), privateId: new acorn_TokenType("privateId", u), eof: new acorn_TokenType("eof"), bracketL: new acorn_TokenType("[", { beforeExpr: true, startsExpr: true }), bracketR: new acorn_TokenType("]"), braceL: new acorn_TokenType("{", { beforeExpr: true, startsExpr: true }), braceR: new acorn_TokenType("}"), parenL: new acorn_TokenType("(", { beforeExpr: true, startsExpr: true }), parenR: new acorn_TokenType(")"), comma: new acorn_TokenType(",", l), semi: new acorn_TokenType(";", l), colon: new acorn_TokenType(":", l), dot: new acorn_TokenType("."), question: new acorn_TokenType("?", l), questionDot: new acorn_TokenType("?."), arrow: new acorn_TokenType("=>", l), template: new acorn_TokenType("template"), invalidTemplate: new acorn_TokenType("invalidTemplate"), ellipsis: new acorn_TokenType("...", l), backQuote: new acorn_TokenType("`", u), dollarBraceL: new acorn_TokenType("${", { beforeExpr: true, startsExpr: true }), eq: new acorn_TokenType("=", { beforeExpr: true, isAssign: true }), assign: new acorn_TokenType("_=", { beforeExpr: true, isAssign: true }), incDec: new acorn_TokenType("++/--", { prefix: true, postfix: true, startsExpr: true }), prefix: new acorn_TokenType("!/~", { beforeExpr: true, prefix: true, startsExpr: true }), logicalOR: binop("||", 1), logicalAND: binop("&&", 2), bitwiseOR: binop("|", 3), bitwiseXOR: binop("^", 4), bitwiseAND: binop("&", 5), equality: binop("==/!=/===/!==", 6), relational: binop("</>/<=/>=", 7), bitShift: binop("<</>>/>>>", 8), plusMin: new acorn_TokenType("+/-", { beforeExpr: true, binop: 9, prefix: true, startsExpr: true }), modulo: binop("%", 10), star: binop("*", 10), slash: binop("/", 10), starstar: new acorn_TokenType("**", { beforeExpr: true }), coalesce: binop("??", 1), _break: kw("break"), _case: kw("case", l), _catch: kw("catch"), _continue: kw("continue"), _debugger: kw("debugger"), _default: kw("default", l), _do: kw("do", { isLoop: true, beforeExpr: true }), _else: kw("else", l), _finally: kw("finally"), _for: kw("for", { isLoop: true }), _function: kw("function", u), _if: kw("if"), _return: kw("return", l), _switch: kw("switch"), _throw: kw("throw", l), _try: kw("try"), _var: kw("var"), _const: kw("const"), _while: kw("while", { isLoop: true }), _with: kw("with"), _new: kw("new", { beforeExpr: true, startsExpr: true }), _this: kw("this", u), _super: kw("super", u), _class: kw("class", u), _extends: kw("extends", l), _export: kw("export"), _import: kw("import", u), _null: kw("null", u), _true: kw("true", u), _false: kw("false", u), _in: kw("in", { beforeExpr: true, binop: 7 }), _instanceof: kw("instanceof", { beforeExpr: true, binop: 7 }), _typeof: kw("typeof", { beforeExpr: true, prefix: true, startsExpr: true }), _void: kw("void", { beforeExpr: true, prefix: true, startsExpr: true }), _delete: kw("delete", { beforeExpr: true, prefix: true, startsExpr: true }) }, m = /\r\n?|\n|\u2028|\u2029/, g = new RegExp(m.source, "g");
        function isNewLine(e3) {
          return 10 === e3 || 13 === e3 || 8232 === e3 || 8233 === e3;
        }
        function nextLineBreak(e3, t3, i2) {
          void 0 === i2 && (i2 = e3.length);
          for (var s2 = t3; s2 < i2; s2++) {
            var r2 = e3.charCodeAt(s2);
            if (isNewLine(r2)) return s2 < i2 - 1 && 13 === r2 && 10 === e3.charCodeAt(s2 + 1) ? s2 + 2 : s2 + 1;
          }
          return -1;
        }
        var x = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/, v = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g, y = Object.prototype, _ = y.hasOwnProperty, E = y.toString, b = Object.hasOwn || function(e3, t3) {
          return _.call(e3, t3);
        }, S = Array.isArray || function(e3) {
          return "[object Array]" === E.call(e3);
        }, k = /* @__PURE__ */ Object.create(null);
        function wordsRegexp(e3) {
          return k[e3] || (k[e3] = new RegExp("^(?:" + e3.replace(/ /g, "|") + ")$"));
        }
        function codePointToString(e3) {
          return e3 <= 65535 ? String.fromCharCode(e3) : (e3 -= 65536, String.fromCharCode(55296 + (e3 >> 10), 56320 + (1023 & e3)));
        }
        var w = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/, acorn_Position = function(e3, t3) {
          this.line = e3, this.column = t3;
        };
        acorn_Position.prototype.offset = function(e3) {
          return new acorn_Position(this.line, this.column + e3);
        };
        var acorn_SourceLocation = function(e3, t3, i2) {
          this.start = t3, this.end = i2, null !== e3.sourceFile && (this.source = e3.sourceFile);
        };
        function getLineInfo(e3, t3) {
          for (var i2 = 1, s2 = 0; ; ) {
            var r2 = nextLineBreak(e3, s2, t3);
            if (r2 < 0) return new acorn_Position(i2, t3 - s2);
            ++i2, s2 = r2;
          }
        }
        var I = { ecmaVersion: null, sourceType: "script", onInsertedSemicolon: null, onTrailingComma: null, allowReserved: null, allowReturnOutsideFunction: false, allowImportExportEverywhere: false, allowAwaitOutsideFunction: null, allowSuperOutsideMethod: null, allowHashBang: false, checkPrivateFields: true, locations: false, onToken: null, onComment: null, ranges: false, program: null, sourceFile: null, directSourceFile: null, preserveParens: false }, C = false;
        function getOptions(e3) {
          var t3 = {};
          for (var i2 in I) t3[i2] = e3 && b(e3, i2) ? e3[i2] : I[i2];
          if ("latest" === t3.ecmaVersion ? t3.ecmaVersion = 1e8 : null == t3.ecmaVersion ? (!C && "object" == typeof console && console.warn && (C = true, console.warn("Since Acorn 8.0.0, options.ecmaVersion is required.\nDefaulting to 2020, but this will stop working in the future.")), t3.ecmaVersion = 11) : t3.ecmaVersion >= 2015 && (t3.ecmaVersion -= 2009), null == t3.allowReserved && (t3.allowReserved = t3.ecmaVersion < 5), e3 && null != e3.allowHashBang || (t3.allowHashBang = t3.ecmaVersion >= 14), S(t3.onToken)) {
            var s2 = t3.onToken;
            t3.onToken = function(e4) {
              return s2.push(e4);
            };
          }
          return S(t3.onComment) && (t3.onComment = /* @__PURE__ */ (function(e4, t4) {
            return function(i3, s3, r2, n2, a2, o2) {
              var h2 = { type: i3 ? "Block" : "Line", value: s3, start: r2, end: n2 };
              e4.locations && (h2.loc = new acorn_SourceLocation(this, a2, o2)), e4.ranges && (h2.range = [r2, n2]), t4.push(h2);
            };
          })(t3, t3.onComment)), t3;
        }
        var R = 256, P = 259;
        function functionFlags(e3, t3) {
          return 2 | (e3 ? 4 : 0) | (t3 ? 8 : 0);
        }
        var acorn_Parser = function(e3, t3, i2) {
          this.options = e3 = getOptions(e3), this.sourceFile = e3.sourceFile, this.keywords = wordsRegexp(o[e3.ecmaVersion >= 6 ? 6 : "module" === e3.sourceType ? "5module" : 5]);
          var s2 = "";
          true !== e3.allowReserved && (s2 = n[e3.ecmaVersion >= 6 ? 6 : 5 === e3.ecmaVersion ? 5 : 3], "module" === e3.sourceType && (s2 += " await")), this.reservedWords = wordsRegexp(s2);
          var r2 = (s2 ? s2 + " " : "") + n.strict;
          this.reservedWordsStrict = wordsRegexp(r2), this.reservedWordsStrictBind = wordsRegexp(r2 + " " + n.strictBind), this.input = String(t3), this.containsEsc = false, i2 ? (this.pos = i2, this.lineStart = this.input.lastIndexOf("\n", i2 - 1) + 1, this.curLine = this.input.slice(0, this.lineStart).split(m).length) : (this.pos = this.lineStart = 0, this.curLine = 1), this.type = f.eof, this.value = null, this.start = this.end = this.pos, this.startLoc = this.endLoc = this.curPosition(), this.lastTokEndLoc = this.lastTokStartLoc = null, this.lastTokStart = this.lastTokEnd = this.pos, this.context = this.initialContext(), this.exprAllowed = true, this.inModule = "module" === e3.sourceType, this.strict = this.inModule || this.strictDirective(this.pos), this.potentialArrowAt = -1, this.potentialArrowInForAwait = false, this.yieldPos = this.awaitPos = this.awaitIdentPos = 0, this.labels = [], this.undefinedExports = /* @__PURE__ */ Object.create(null), 0 === this.pos && e3.allowHashBang && "#!" === this.input.slice(0, 2) && this.skipLineComment(2), this.scopeStack = [], this.enterScope(1), this.regexpState = null, this.privateNameStack = [];
        }, T = { inFunction: { configurable: true }, inGenerator: { configurable: true }, inAsync: { configurable: true }, canAwait: { configurable: true }, allowSuper: { configurable: true }, allowDirectSuper: { configurable: true }, treatFunctionsAsVar: { configurable: true }, allowNewDotTarget: { configurable: true }, inClassStaticBlock: { configurable: true } };
        acorn_Parser.prototype.parse = function() {
          var e3 = this.options.program || this.startNode();
          return this.nextToken(), this.parseTopLevel(e3);
        }, T.inFunction.get = function() {
          return (2 & this.currentVarScope().flags) > 0;
        }, T.inGenerator.get = function() {
          return (8 & this.currentVarScope().flags) > 0;
        }, T.inAsync.get = function() {
          return (4 & this.currentVarScope().flags) > 0;
        }, T.canAwait.get = function() {
          for (var e3 = this.scopeStack.length - 1; e3 >= 0; e3--) {
            var t3 = this.scopeStack[e3].flags;
            if (768 & t3) return false;
            if (2 & t3) return (4 & t3) > 0;
          }
          return this.inModule && this.options.ecmaVersion >= 13 || this.options.allowAwaitOutsideFunction;
        }, T.allowSuper.get = function() {
          return (64 & this.currentThisScope().flags) > 0 || this.options.allowSuperOutsideMethod;
        }, T.allowDirectSuper.get = function() {
          return (128 & this.currentThisScope().flags) > 0;
        }, T.treatFunctionsAsVar.get = function() {
          return this.treatFunctionsAsVarInScope(this.currentScope());
        }, T.allowNewDotTarget.get = function() {
          for (var e3 = this.scopeStack.length - 1; e3 >= 0; e3--) {
            var t3 = this.scopeStack[e3].flags;
            if (768 & t3 || 2 & t3 && !(16 & t3)) return true;
          }
          return false;
        }, T.inClassStaticBlock.get = function() {
          return (this.currentVarScope().flags & R) > 0;
        }, acorn_Parser.extend = function() {
          for (var e3 = [], t3 = arguments.length; t3--; ) e3[t3] = arguments[t3];
          for (var i2 = this, s2 = 0; s2 < e3.length; s2++) i2 = e3[s2](i2);
          return i2;
        }, acorn_Parser.parse = function(e3, t3) {
          return new this(t3, e3).parse();
        }, acorn_Parser.parseExpressionAt = function(e3, t3, i2) {
          var s2 = new this(i2, e3, t3);
          return s2.nextToken(), s2.parseExpression();
        }, acorn_Parser.tokenizer = function(e3, t3) {
          return new this(t3, e3);
        }, Object.defineProperties(acorn_Parser.prototype, T);
        var A = acorn_Parser.prototype, N = /^(?:'((?:\\[^]|[^'\\])*?)'|"((?:\\[^]|[^"\\])*?)")/;
        A.strictDirective = function(e3) {
          if (this.options.ecmaVersion < 5) return false;
          for (; ; ) {
            v.lastIndex = e3, e3 += v.exec(this.input)[0].length;
            var t3 = N.exec(this.input.slice(e3));
            if (!t3) return false;
            if ("use strict" === (t3[1] || t3[2])) {
              v.lastIndex = e3 + t3[0].length;
              var i2 = v.exec(this.input), s2 = i2.index + i2[0].length, r2 = this.input.charAt(s2);
              return ";" === r2 || "}" === r2 || m.test(i2[0]) && !(/[(`.[+\-/*%<>=,?^&]/.test(r2) || "!" === r2 && "=" === this.input.charAt(s2 + 1));
            }
            e3 += t3[0].length, v.lastIndex = e3, e3 += v.exec(this.input)[0].length, ";" === this.input[e3] && e3++;
          }
        }, A.eat = function(e3) {
          return this.type === e3 && (this.next(), true);
        }, A.isContextual = function(e3) {
          return this.type === f.name && this.value === e3 && !this.containsEsc;
        }, A.eatContextual = function(e3) {
          return !!this.isContextual(e3) && (this.next(), true);
        }, A.expectContextual = function(e3) {
          this.eatContextual(e3) || this.unexpected();
        }, A.canInsertSemicolon = function() {
          return this.type === f.eof || this.type === f.braceR || m.test(this.input.slice(this.lastTokEnd, this.start));
        }, A.insertSemicolon = function() {
          if (this.canInsertSemicolon()) return this.options.onInsertedSemicolon && this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc), true;
        }, A.semicolon = function() {
          this.eat(f.semi) || this.insertSemicolon() || this.unexpected();
        }, A.afterTrailingComma = function(e3, t3) {
          if (this.type === e3) return this.options.onTrailingComma && this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc), t3 || this.next(), true;
        }, A.expect = function(e3) {
          this.eat(e3) || this.unexpected();
        }, A.unexpected = function(e3) {
          this.raise(null != e3 ? e3 : this.start, "Unexpected token");
        };
        var acorn_DestructuringErrors = function() {
          this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = this.doubleProto = -1;
        };
        A.checkPatternErrors = function(e3, t3) {
          if (e3) {
            e3.trailingComma > -1 && this.raiseRecoverable(e3.trailingComma, "Comma is not permitted after the rest element");
            var i2 = t3 ? e3.parenthesizedAssign : e3.parenthesizedBind;
            i2 > -1 && this.raiseRecoverable(i2, t3 ? "Assigning to rvalue" : "Parenthesized pattern");
          }
        }, A.checkExpressionErrors = function(e3, t3) {
          if (!e3) return false;
          var i2 = e3.shorthandAssign, s2 = e3.doubleProto;
          if (!t3) return i2 >= 0 || s2 >= 0;
          i2 >= 0 && this.raise(i2, "Shorthand property assignments are valid only in destructuring patterns"), s2 >= 0 && this.raiseRecoverable(s2, "Redefinition of __proto__ property");
        }, A.checkYieldAwaitInDefaultParams = function() {
          this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos) && this.raise(this.yieldPos, "Yield expression cannot be a default value"), this.awaitPos && this.raise(this.awaitPos, "Await expression cannot be a default value");
        }, A.isSimpleAssignTarget = function(e3) {
          return "ParenthesizedExpression" === e3.type ? this.isSimpleAssignTarget(e3.expression) : "Identifier" === e3.type || "MemberExpression" === e3.type;
        };
        var L = acorn_Parser.prototype;
        L.parseTopLevel = function(e3) {
          var t3 = /* @__PURE__ */ Object.create(null);
          for (e3.body || (e3.body = []); this.type !== f.eof; ) {
            var i2 = this.parseStatement(null, true, t3);
            e3.body.push(i2);
          }
          if (this.inModule) for (var s2 = 0, r2 = Object.keys(this.undefinedExports); s2 < r2.length; s2 += 1) {
            var n2 = r2[s2];
            this.raiseRecoverable(this.undefinedExports[n2].start, "Export '" + n2 + "' is not defined");
          }
          return this.adaptDirectivePrologue(e3.body), this.next(), e3.sourceType = this.options.sourceType, this.finishNode(e3, "Program");
        };
        var O = { kind: "loop" }, D = { kind: "switch" };
        L.isLet = function(e3) {
          if (this.options.ecmaVersion < 6 || !this.isContextual("let")) return false;
          v.lastIndex = this.pos;
          var t3 = v.exec(this.input), i2 = this.pos + t3[0].length, s2 = this.input.charCodeAt(i2);
          if (91 === s2 || 92 === s2) return true;
          if (e3) return false;
          if (123 === s2 || s2 > 55295 && s2 < 56320) return true;
          if (isIdentifierStart(s2, true)) {
            for (var r2 = i2 + 1; isIdentifierChar(s2 = this.input.charCodeAt(r2), true); ) ++r2;
            if (92 === s2 || s2 > 55295 && s2 < 56320) return true;
            var n2 = this.input.slice(i2, r2);
            if (!h.test(n2)) return true;
          }
          return false;
        }, L.isAsyncFunction = function() {
          if (this.options.ecmaVersion < 8 || !this.isContextual("async")) return false;
          v.lastIndex = this.pos;
          var e3, t3 = v.exec(this.input), i2 = this.pos + t3[0].length;
          return !(m.test(this.input.slice(this.pos, i2)) || "function" !== this.input.slice(i2, i2 + 8) || i2 + 8 !== this.input.length && (isIdentifierChar(e3 = this.input.charCodeAt(i2 + 8)) || e3 > 55295 && e3 < 56320));
        }, L.isUsingKeyword = function(e3, t3) {
          if (this.options.ecmaVersion < 17 || !this.isContextual(e3 ? "await" : "using")) return false;
          v.lastIndex = this.pos;
          var i2 = v.exec(this.input), s2 = this.pos + i2[0].length;
          if (m.test(this.input.slice(this.pos, s2))) return false;
          if (e3) {
            var r2, n2 = s2 + 5;
            if ("using" !== this.input.slice(s2, n2) || n2 === this.input.length || isIdentifierChar(r2 = this.input.charCodeAt(n2)) || r2 > 55295 && r2 < 56320) return false;
            v.lastIndex = n2;
            var a2 = v.exec(this.input);
            if (a2 && m.test(this.input.slice(n2, n2 + a2[0].length))) return false;
          }
          if (t3) {
            var o2, h2 = s2 + 2;
            if (!("of" !== this.input.slice(s2, h2) || h2 !== this.input.length && (isIdentifierChar(o2 = this.input.charCodeAt(h2)) || o2 > 55295 && o2 < 56320))) return false;
          }
          var c2 = this.input.charCodeAt(s2);
          return isIdentifierStart(c2, true) || 92 === c2;
        }, L.isAwaitUsing = function(e3) {
          return this.isUsingKeyword(true, e3);
        }, L.isUsing = function(e3) {
          return this.isUsingKeyword(false, e3);
        }, L.parseStatement = function(e3, t3, i2) {
          var s2, r2 = this.type, n2 = this.startNode();
          switch (this.isLet(e3) && (r2 = f._var, s2 = "let"), r2) {
            case f._break:
            case f._continue:
              return this.parseBreakContinueStatement(n2, r2.keyword);
            case f._debugger:
              return this.parseDebuggerStatement(n2);
            case f._do:
              return this.parseDoStatement(n2);
            case f._for:
              return this.parseForStatement(n2);
            case f._function:
              return e3 && (this.strict || "if" !== e3 && "label" !== e3) && this.options.ecmaVersion >= 6 && this.unexpected(), this.parseFunctionStatement(n2, false, !e3);
            case f._class:
              return e3 && this.unexpected(), this.parseClass(n2, true);
            case f._if:
              return this.parseIfStatement(n2);
            case f._return:
              return this.parseReturnStatement(n2);
            case f._switch:
              return this.parseSwitchStatement(n2);
            case f._throw:
              return this.parseThrowStatement(n2);
            case f._try:
              return this.parseTryStatement(n2);
            case f._const:
            case f._var:
              return s2 = s2 || this.value, e3 && "var" !== s2 && this.unexpected(), this.parseVarStatement(n2, s2);
            case f._while:
              return this.parseWhileStatement(n2);
            case f._with:
              return this.parseWithStatement(n2);
            case f.braceL:
              return this.parseBlock(true, n2);
            case f.semi:
              return this.parseEmptyStatement(n2);
            case f._export:
            case f._import:
              if (this.options.ecmaVersion > 10 && r2 === f._import) {
                v.lastIndex = this.pos;
                var a2 = v.exec(this.input), o2 = this.pos + a2[0].length, h2 = this.input.charCodeAt(o2);
                if (40 === h2 || 46 === h2) return this.parseExpressionStatement(n2, this.parseExpression());
              }
              return this.options.allowImportExportEverywhere || (t3 || this.raise(this.start, "'import' and 'export' may only appear at the top level"), this.inModule || this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'")), r2 === f._import ? this.parseImport(n2) : this.parseExport(n2, i2);
            default:
              if (this.isAsyncFunction()) return e3 && this.unexpected(), this.next(), this.parseFunctionStatement(n2, true, !e3);
              var c2 = this.isAwaitUsing(false) ? "await using" : this.isUsing(false) ? "using" : null;
              if (c2) return t3 && "script" === this.options.sourceType && this.raise(this.start, "Using declaration cannot appear in the top level when source type is `script`"), "await using" === c2 && (this.canAwait || this.raise(this.start, "Await using cannot appear outside of async function"), this.next()), this.next(), this.parseVar(n2, false, c2), this.semicolon(), this.finishNode(n2, "VariableDeclaration");
              var p2 = this.value, l2 = this.parseExpression();
              return r2 === f.name && "Identifier" === l2.type && this.eat(f.colon) ? this.parseLabeledStatement(n2, p2, l2, e3) : this.parseExpressionStatement(n2, l2);
          }
        }, L.parseBreakContinueStatement = function(e3, t3) {
          var i2 = "break" === t3;
          this.next(), this.eat(f.semi) || this.insertSemicolon() ? e3.label = null : this.type !== f.name ? this.unexpected() : (e3.label = this.parseIdent(), this.semicolon());
          for (var s2 = 0; s2 < this.labels.length; ++s2) {
            var r2 = this.labels[s2];
            if (null == e3.label || r2.name === e3.label.name) {
              if (null != r2.kind && (i2 || "loop" === r2.kind)) break;
              if (e3.label && i2) break;
            }
          }
          return s2 === this.labels.length && this.raise(e3.start, "Unsyntactic " + t3), this.finishNode(e3, i2 ? "BreakStatement" : "ContinueStatement");
        }, L.parseDebuggerStatement = function(e3) {
          return this.next(), this.semicolon(), this.finishNode(e3, "DebuggerStatement");
        }, L.parseDoStatement = function(e3) {
          return this.next(), this.labels.push(O), e3.body = this.parseStatement("do"), this.labels.pop(), this.expect(f._while), e3.test = this.parseParenExpression(), this.options.ecmaVersion >= 6 ? this.eat(f.semi) : this.semicolon(), this.finishNode(e3, "DoWhileStatement");
        }, L.parseForStatement = function(e3) {
          this.next();
          var t3 = this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual("await") ? this.lastTokStart : -1;
          if (this.labels.push(O), this.enterScope(0), this.expect(f.parenL), this.type === f.semi) return t3 > -1 && this.unexpected(t3), this.parseFor(e3, null);
          var i2 = this.isLet();
          if (this.type === f._var || this.type === f._const || i2) {
            var s2 = this.startNode(), r2 = i2 ? "let" : this.value;
            return this.next(), this.parseVar(s2, true, r2), this.finishNode(s2, "VariableDeclaration"), this.parseForAfterInit(e3, s2, t3);
          }
          var n2 = this.isContextual("let"), a2 = false, o2 = this.isUsing(true) ? "using" : this.isAwaitUsing(true) ? "await using" : null;
          if (o2) {
            var h2 = this.startNode();
            return this.next(), "await using" === o2 && this.next(), this.parseVar(h2, true, o2), this.finishNode(h2, "VariableDeclaration"), this.parseForAfterInit(e3, h2, t3);
          }
          var c2 = this.containsEsc, p2 = new acorn_DestructuringErrors(), l2 = this.start, u2 = t3 > -1 ? this.parseExprSubscripts(p2, "await") : this.parseExpression(true, p2);
          return this.type === f._in || (a2 = this.options.ecmaVersion >= 6 && this.isContextual("of")) ? (t3 > -1 ? (this.type === f._in && this.unexpected(t3), e3.await = true) : a2 && this.options.ecmaVersion >= 8 && (u2.start !== l2 || c2 || "Identifier" !== u2.type || "async" !== u2.name ? this.options.ecmaVersion >= 9 && (e3.await = false) : this.unexpected()), n2 && a2 && this.raise(u2.start, "The left-hand side of a for-of loop may not start with 'let'."), this.toAssignable(u2, false, p2), this.checkLValPattern(u2), this.parseForIn(e3, u2)) : (this.checkExpressionErrors(p2, true), t3 > -1 && this.unexpected(t3), this.parseFor(e3, u2));
        }, L.parseForAfterInit = function(e3, t3, i2) {
          return (this.type === f._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && 1 === t3.declarations.length ? (this.options.ecmaVersion >= 9 && (this.type === f._in ? i2 > -1 && this.unexpected(i2) : e3.await = i2 > -1), this.parseForIn(e3, t3)) : (i2 > -1 && this.unexpected(i2), this.parseFor(e3, t3));
        }, L.parseFunctionStatement = function(e3, t3, i2) {
          return this.next(), this.parseFunction(e3, U | (i2 ? 0 : M), false, t3);
        }, L.parseIfStatement = function(e3) {
          return this.next(), e3.test = this.parseParenExpression(), e3.consequent = this.parseStatement("if"), e3.alternate = this.eat(f._else) ? this.parseStatement("if") : null, this.finishNode(e3, "IfStatement");
        }, L.parseReturnStatement = function(e3) {
          return this.inFunction || this.options.allowReturnOutsideFunction || this.raise(this.start, "'return' outside of function"), this.next(), this.eat(f.semi) || this.insertSemicolon() ? e3.argument = null : (e3.argument = this.parseExpression(), this.semicolon()), this.finishNode(e3, "ReturnStatement");
        }, L.parseSwitchStatement = function(e3) {
          var t3;
          this.next(), e3.discriminant = this.parseParenExpression(), e3.cases = [], this.expect(f.braceL), this.labels.push(D), this.enterScope(0);
          for (var i2 = false; this.type !== f.braceR; ) if (this.type === f._case || this.type === f._default) {
            var s2 = this.type === f._case;
            t3 && this.finishNode(t3, "SwitchCase"), e3.cases.push(t3 = this.startNode()), t3.consequent = [], this.next(), s2 ? t3.test = this.parseExpression() : (i2 && this.raiseRecoverable(this.lastTokStart, "Multiple default clauses"), i2 = true, t3.test = null), this.expect(f.colon);
          } else t3 || this.unexpected(), t3.consequent.push(this.parseStatement(null));
          return this.exitScope(), t3 && this.finishNode(t3, "SwitchCase"), this.next(), this.labels.pop(), this.finishNode(e3, "SwitchStatement");
        }, L.parseThrowStatement = function(e3) {
          return this.next(), m.test(this.input.slice(this.lastTokEnd, this.start)) && this.raise(this.lastTokEnd, "Illegal newline after throw"), e3.argument = this.parseExpression(), this.semicolon(), this.finishNode(e3, "ThrowStatement");
        };
        var V = [];
        L.parseCatchClauseParam = function() {
          var e3 = this.parseBindingAtom(), t3 = "Identifier" === e3.type;
          return this.enterScope(t3 ? 32 : 0), this.checkLValPattern(e3, t3 ? 4 : 2), this.expect(f.parenR), e3;
        }, L.parseTryStatement = function(e3) {
          if (this.next(), e3.block = this.parseBlock(), e3.handler = null, this.type === f._catch) {
            var t3 = this.startNode();
            this.next(), this.eat(f.parenL) ? t3.param = this.parseCatchClauseParam() : (this.options.ecmaVersion < 10 && this.unexpected(), t3.param = null, this.enterScope(0)), t3.body = this.parseBlock(false), this.exitScope(), e3.handler = this.finishNode(t3, "CatchClause");
          }
          return e3.finalizer = this.eat(f._finally) ? this.parseBlock() : null, e3.handler || e3.finalizer || this.raise(e3.start, "Missing catch or finally clause"), this.finishNode(e3, "TryStatement");
        }, L.parseVarStatement = function(e3, t3, i2) {
          return this.next(), this.parseVar(e3, false, t3, i2), this.semicolon(), this.finishNode(e3, "VariableDeclaration");
        }, L.parseWhileStatement = function(e3) {
          return this.next(), e3.test = this.parseParenExpression(), this.labels.push(O), e3.body = this.parseStatement("while"), this.labels.pop(), this.finishNode(e3, "WhileStatement");
        }, L.parseWithStatement = function(e3) {
          return this.strict && this.raise(this.start, "'with' in strict mode"), this.next(), e3.object = this.parseParenExpression(), e3.body = this.parseStatement("with"), this.finishNode(e3, "WithStatement");
        }, L.parseEmptyStatement = function(e3) {
          return this.next(), this.finishNode(e3, "EmptyStatement");
        }, L.parseLabeledStatement = function(e3, t3, i2, s2) {
          for (var r2 = 0, n2 = this.labels; r2 < n2.length; r2 += 1) {
            n2[r2].name === t3 && this.raise(i2.start, "Label '" + t3 + "' is already declared");
          }
          for (var a2 = this.type.isLoop ? "loop" : this.type === f._switch ? "switch" : null, o2 = this.labels.length - 1; o2 >= 0; o2--) {
            var h2 = this.labels[o2];
            if (h2.statementStart !== e3.start) break;
            h2.statementStart = this.start, h2.kind = a2;
          }
          return this.labels.push({ name: t3, kind: a2, statementStart: this.start }), e3.body = this.parseStatement(s2 ? -1 === s2.indexOf("label") ? s2 + "label" : s2 : "label"), this.labels.pop(), e3.label = i2, this.finishNode(e3, "LabeledStatement");
        }, L.parseExpressionStatement = function(e3, t3) {
          return e3.expression = t3, this.semicolon(), this.finishNode(e3, "ExpressionStatement");
        }, L.parseBlock = function(e3, t3, i2) {
          for (void 0 === e3 && (e3 = true), void 0 === t3 && (t3 = this.startNode()), t3.body = [], this.expect(f.braceL), e3 && this.enterScope(0); this.type !== f.braceR; ) {
            var s2 = this.parseStatement(null);
            t3.body.push(s2);
          }
          return i2 && (this.strict = false), this.next(), e3 && this.exitScope(), this.finishNode(t3, "BlockStatement");
        }, L.parseFor = function(e3, t3) {
          return e3.init = t3, this.expect(f.semi), e3.test = this.type === f.semi ? null : this.parseExpression(), this.expect(f.semi), e3.update = this.type === f.parenR ? null : this.parseExpression(), this.expect(f.parenR), e3.body = this.parseStatement("for"), this.exitScope(), this.labels.pop(), this.finishNode(e3, "ForStatement");
        }, L.parseForIn = function(e3, t3) {
          var i2 = this.type === f._in;
          return this.next(), "VariableDeclaration" === t3.type && null != t3.declarations[0].init && (!i2 || this.options.ecmaVersion < 8 || this.strict || "var" !== t3.kind || "Identifier" !== t3.declarations[0].id.type) && this.raise(t3.start, (i2 ? "for-in" : "for-of") + " loop variable declaration may not have an initializer"), e3.left = t3, e3.right = i2 ? this.parseExpression() : this.parseMaybeAssign(), this.expect(f.parenR), e3.body = this.parseStatement("for"), this.exitScope(), this.labels.pop(), this.finishNode(e3, i2 ? "ForInStatement" : "ForOfStatement");
        }, L.parseVar = function(e3, t3, i2, s2) {
          for (e3.declarations = [], e3.kind = i2; ; ) {
            var r2 = this.startNode();
            if (this.parseVarId(r2, i2), this.eat(f.eq) ? r2.init = this.parseMaybeAssign(t3) : s2 || "const" !== i2 || this.type === f._in || this.options.ecmaVersion >= 6 && this.isContextual("of") ? s2 || "using" !== i2 && "await using" !== i2 || !(this.options.ecmaVersion >= 17) || this.type === f._in || this.isContextual("of") ? s2 || "Identifier" === r2.id.type || t3 && (this.type === f._in || this.isContextual("of")) ? r2.init = null : this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value") : this.raise(this.lastTokEnd, "Missing initializer in " + i2 + " declaration") : this.unexpected(), e3.declarations.push(this.finishNode(r2, "VariableDeclarator")), !this.eat(f.comma)) break;
          }
          return e3;
        }, L.parseVarId = function(e3, t3) {
          e3.id = "using" === t3 || "await using" === t3 ? this.parseIdent() : this.parseBindingAtom(), this.checkLValPattern(e3.id, "var" === t3 ? 1 : 2, false);
        };
        var U = 1, M = 2;
        function isPrivateNameConflicted(e3, t3) {
          var i2 = t3.key.name, s2 = e3[i2], r2 = "true";
          return "MethodDefinition" !== t3.type || "get" !== t3.kind && "set" !== t3.kind || (r2 = (t3.static ? "s" : "i") + t3.kind), "iget" === s2 && "iset" === r2 || "iset" === s2 && "iget" === r2 || "sget" === s2 && "sset" === r2 || "sset" === s2 && "sget" === r2 ? (e3[i2] = "true", false) : !!s2 || (e3[i2] = r2, false);
        }
        function checkKeyName(e3, t3) {
          var i2 = e3.computed, s2 = e3.key;
          return !i2 && ("Identifier" === s2.type && s2.name === t3 || "Literal" === s2.type && s2.value === t3);
        }
        L.parseFunction = function(e3, t3, i2, s2, r2) {
          this.initFunction(e3), (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !s2) && (this.type === f.star && t3 & M && this.unexpected(), e3.generator = this.eat(f.star)), this.options.ecmaVersion >= 8 && (e3.async = !!s2), t3 & U && (e3.id = 4 & t3 && this.type !== f.name ? null : this.parseIdent(), !e3.id || t3 & M || this.checkLValSimple(e3.id, this.strict || e3.generator || e3.async ? this.treatFunctionsAsVar ? 1 : 2 : 3));
          var n2 = this.yieldPos, a2 = this.awaitPos, o2 = this.awaitIdentPos;
          return this.yieldPos = 0, this.awaitPos = 0, this.awaitIdentPos = 0, this.enterScope(functionFlags(e3.async, e3.generator)), t3 & U || (e3.id = this.type === f.name ? this.parseIdent() : null), this.parseFunctionParams(e3), this.parseFunctionBody(e3, i2, false, r2), this.yieldPos = n2, this.awaitPos = a2, this.awaitIdentPos = o2, this.finishNode(e3, t3 & U ? "FunctionDeclaration" : "FunctionExpression");
        }, L.parseFunctionParams = function(e3) {
          this.expect(f.parenL), e3.params = this.parseBindingList(f.parenR, false, this.options.ecmaVersion >= 8), this.checkYieldAwaitInDefaultParams();
        }, L.parseClass = function(e3, t3) {
          this.next();
          var i2 = this.strict;
          this.strict = true, this.parseClassId(e3, t3), this.parseClassSuper(e3);
          var s2 = this.enterClassBody(), r2 = this.startNode(), n2 = false;
          for (r2.body = [], this.expect(f.braceL); this.type !== f.braceR; ) {
            var a2 = this.parseClassElement(null !== e3.superClass);
            a2 && (r2.body.push(a2), "MethodDefinition" === a2.type && "constructor" === a2.kind ? (n2 && this.raiseRecoverable(a2.start, "Duplicate constructor in the same class"), n2 = true) : a2.key && "PrivateIdentifier" === a2.key.type && isPrivateNameConflicted(s2, a2) && this.raiseRecoverable(a2.key.start, "Identifier '#" + a2.key.name + "' has already been declared"));
          }
          return this.strict = i2, this.next(), e3.body = this.finishNode(r2, "ClassBody"), this.exitClassBody(), this.finishNode(e3, t3 ? "ClassDeclaration" : "ClassExpression");
        }, L.parseClassElement = function(e3) {
          if (this.eat(f.semi)) return null;
          var t3 = this.options.ecmaVersion, i2 = this.startNode(), s2 = "", r2 = false, n2 = false, a2 = "method", o2 = false;
          if (this.eatContextual("static")) {
            if (t3 >= 13 && this.eat(f.braceL)) return this.parseClassStaticBlock(i2), i2;
            this.isClassElementNameStart() || this.type === f.star ? o2 = true : s2 = "static";
          }
          if (i2.static = o2, !s2 && t3 >= 8 && this.eatContextual("async") && (!this.isClassElementNameStart() && this.type !== f.star || this.canInsertSemicolon() ? s2 = "async" : n2 = true), !s2 && (t3 >= 9 || !n2) && this.eat(f.star) && (r2 = true), !s2 && !n2 && !r2) {
            var h2 = this.value;
            (this.eatContextual("get") || this.eatContextual("set")) && (this.isClassElementNameStart() ? a2 = h2 : s2 = h2);
          }
          if (s2 ? (i2.computed = false, i2.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc), i2.key.name = s2, this.finishNode(i2.key, "Identifier")) : this.parseClassElementName(i2), t3 < 13 || this.type === f.parenL || "method" !== a2 || r2 || n2) {
            var c2 = !i2.static && checkKeyName(i2, "constructor"), p2 = c2 && e3;
            c2 && "method" !== a2 && this.raise(i2.key.start, "Constructor can't have get/set modifier"), i2.kind = c2 ? "constructor" : a2, this.parseClassMethod(i2, r2, n2, p2);
          } else this.parseClassField(i2);
          return i2;
        }, L.isClassElementNameStart = function() {
          return this.type === f.name || this.type === f.privateId || this.type === f.num || this.type === f.string || this.type === f.bracketL || this.type.keyword;
        }, L.parseClassElementName = function(e3) {
          this.type === f.privateId ? ("constructor" === this.value && this.raise(this.start, "Classes can't have an element named '#constructor'"), e3.computed = false, e3.key = this.parsePrivateIdent()) : this.parsePropertyName(e3);
        }, L.parseClassMethod = function(e3, t3, i2, s2) {
          var r2 = e3.key;
          "constructor" === e3.kind ? (t3 && this.raise(r2.start, "Constructor can't be a generator"), i2 && this.raise(r2.start, "Constructor can't be an async method")) : e3.static && checkKeyName(e3, "prototype") && this.raise(r2.start, "Classes may not have a static property named prototype");
          var n2 = e3.value = this.parseMethod(t3, i2, s2);
          return "get" === e3.kind && 0 !== n2.params.length && this.raiseRecoverable(n2.start, "getter should have no params"), "set" === e3.kind && 1 !== n2.params.length && this.raiseRecoverable(n2.start, "setter should have exactly one param"), "set" === e3.kind && "RestElement" === n2.params[0].type && this.raiseRecoverable(n2.params[0].start, "Setter cannot use rest params"), this.finishNode(e3, "MethodDefinition");
        }, L.parseClassField = function(e3) {
          return checkKeyName(e3, "constructor") ? this.raise(e3.key.start, "Classes can't have a field named 'constructor'") : e3.static && checkKeyName(e3, "prototype") && this.raise(e3.key.start, "Classes can't have a static field named 'prototype'"), this.eat(f.eq) ? (this.enterScope(576), e3.value = this.parseMaybeAssign(), this.exitScope()) : e3.value = null, this.semicolon(), this.finishNode(e3, "PropertyDefinition");
        }, L.parseClassStaticBlock = function(e3) {
          e3.body = [];
          var t3 = this.labels;
          for (this.labels = [], this.enterScope(320); this.type !== f.braceR; ) {
            var i2 = this.parseStatement(null);
            e3.body.push(i2);
          }
          return this.next(), this.exitScope(), this.labels = t3, this.finishNode(e3, "StaticBlock");
        }, L.parseClassId = function(e3, t3) {
          this.type === f.name ? (e3.id = this.parseIdent(), t3 && this.checkLValSimple(e3.id, 2, false)) : (true === t3 && this.unexpected(), e3.id = null);
        }, L.parseClassSuper = function(e3) {
          e3.superClass = this.eat(f._extends) ? this.parseExprSubscripts(null, false) : null;
        }, L.enterClassBody = function() {
          var e3 = { declared: /* @__PURE__ */ Object.create(null), used: [] };
          return this.privateNameStack.push(e3), e3.declared;
        }, L.exitClassBody = function() {
          var e3 = this.privateNameStack.pop(), t3 = e3.declared, i2 = e3.used;
          if (this.options.checkPrivateFields) for (var s2 = this.privateNameStack.length, r2 = 0 === s2 ? null : this.privateNameStack[s2 - 1], n2 = 0; n2 < i2.length; ++n2) {
            var a2 = i2[n2];
            b(t3, a2.name) || (r2 ? r2.used.push(a2) : this.raiseRecoverable(a2.start, "Private field '#" + a2.name + "' must be declared in an enclosing class"));
          }
        }, L.parseExportAllDeclaration = function(e3, t3) {
          return this.options.ecmaVersion >= 11 && (this.eatContextual("as") ? (e3.exported = this.parseModuleExportName(), this.checkExport(t3, e3.exported, this.lastTokStart)) : e3.exported = null), this.expectContextual("from"), this.type !== f.string && this.unexpected(), e3.source = this.parseExprAtom(), this.options.ecmaVersion >= 16 && (e3.attributes = this.parseWithClause()), this.semicolon(), this.finishNode(e3, "ExportAllDeclaration");
        }, L.parseExport = function(e3, t3) {
          if (this.next(), this.eat(f.star)) return this.parseExportAllDeclaration(e3, t3);
          if (this.eat(f._default)) return this.checkExport(t3, "default", this.lastTokStart), e3.declaration = this.parseExportDefaultDeclaration(), this.finishNode(e3, "ExportDefaultDeclaration");
          if (this.shouldParseExportStatement()) e3.declaration = this.parseExportDeclaration(e3), "VariableDeclaration" === e3.declaration.type ? this.checkVariableExport(t3, e3.declaration.declarations) : this.checkExport(t3, e3.declaration.id, e3.declaration.id.start), e3.specifiers = [], e3.source = null, this.options.ecmaVersion >= 16 && (e3.attributes = []);
          else {
            if (e3.declaration = null, e3.specifiers = this.parseExportSpecifiers(t3), this.eatContextual("from")) this.type !== f.string && this.unexpected(), e3.source = this.parseExprAtom(), this.options.ecmaVersion >= 16 && (e3.attributes = this.parseWithClause());
            else {
              for (var i2 = 0, s2 = e3.specifiers; i2 < s2.length; i2 += 1) {
                var r2 = s2[i2];
                this.checkUnreserved(r2.local), this.checkLocalExport(r2.local), "Literal" === r2.local.type && this.raise(r2.local.start, "A string literal cannot be used as an exported binding without `from`.");
              }
              e3.source = null, this.options.ecmaVersion >= 16 && (e3.attributes = []);
            }
            this.semicolon();
          }
          return this.finishNode(e3, "ExportNamedDeclaration");
        }, L.parseExportDeclaration = function(e3) {
          return this.parseStatement(null);
        }, L.parseExportDefaultDeclaration = function() {
          var e3;
          if (this.type === f._function || (e3 = this.isAsyncFunction())) {
            var t3 = this.startNode();
            return this.next(), e3 && this.next(), this.parseFunction(t3, 4 | U, false, e3);
          }
          if (this.type === f._class) {
            var i2 = this.startNode();
            return this.parseClass(i2, "nullableID");
          }
          var s2 = this.parseMaybeAssign();
          return this.semicolon(), s2;
        }, L.checkExport = function(e3, t3, i2) {
          e3 && ("string" != typeof t3 && (t3 = "Identifier" === t3.type ? t3.name : t3.value), b(e3, t3) && this.raiseRecoverable(i2, "Duplicate export '" + t3 + "'"), e3[t3] = true);
        }, L.checkPatternExport = function(e3, t3) {
          var i2 = t3.type;
          if ("Identifier" === i2) this.checkExport(e3, t3, t3.start);
          else if ("ObjectPattern" === i2) for (var s2 = 0, r2 = t3.properties; s2 < r2.length; s2 += 1) {
            var n2 = r2[s2];
            this.checkPatternExport(e3, n2);
          }
          else if ("ArrayPattern" === i2) for (var a2 = 0, o2 = t3.elements; a2 < o2.length; a2 += 1) {
            var h2 = o2[a2];
            h2 && this.checkPatternExport(e3, h2);
          }
          else "Property" === i2 ? this.checkPatternExport(e3, t3.value) : "AssignmentPattern" === i2 ? this.checkPatternExport(e3, t3.left) : "RestElement" === i2 && this.checkPatternExport(e3, t3.argument);
        }, L.checkVariableExport = function(e3, t3) {
          if (e3) for (var i2 = 0, s2 = t3; i2 < s2.length; i2 += 1) {
            var r2 = s2[i2];
            this.checkPatternExport(e3, r2.id);
          }
        }, L.shouldParseExportStatement = function() {
          return "var" === this.type.keyword || "const" === this.type.keyword || "class" === this.type.keyword || "function" === this.type.keyword || this.isLet() || this.isAsyncFunction();
        }, L.parseExportSpecifier = function(e3) {
          var t3 = this.startNode();
          return t3.local = this.parseModuleExportName(), t3.exported = this.eatContextual("as") ? this.parseModuleExportName() : t3.local, this.checkExport(e3, t3.exported, t3.exported.start), this.finishNode(t3, "ExportSpecifier");
        }, L.parseExportSpecifiers = function(e3) {
          var t3 = [], i2 = true;
          for (this.expect(f.braceL); !this.eat(f.braceR); ) {
            if (i2) i2 = false;
            else if (this.expect(f.comma), this.afterTrailingComma(f.braceR)) break;
            t3.push(this.parseExportSpecifier(e3));
          }
          return t3;
        }, L.parseImport = function(e3) {
          return this.next(), this.type === f.string ? (e3.specifiers = V, e3.source = this.parseExprAtom()) : (e3.specifiers = this.parseImportSpecifiers(), this.expectContextual("from"), e3.source = this.type === f.string ? this.parseExprAtom() : this.unexpected()), this.options.ecmaVersion >= 16 && (e3.attributes = this.parseWithClause()), this.semicolon(), this.finishNode(e3, "ImportDeclaration");
        }, L.parseImportSpecifier = function() {
          var e3 = this.startNode();
          return e3.imported = this.parseModuleExportName(), this.eatContextual("as") ? e3.local = this.parseIdent() : (this.checkUnreserved(e3.imported), e3.local = e3.imported), this.checkLValSimple(e3.local, 2), this.finishNode(e3, "ImportSpecifier");
        }, L.parseImportDefaultSpecifier = function() {
          var e3 = this.startNode();
          return e3.local = this.parseIdent(), this.checkLValSimple(e3.local, 2), this.finishNode(e3, "ImportDefaultSpecifier");
        }, L.parseImportNamespaceSpecifier = function() {
          var e3 = this.startNode();
          return this.next(), this.expectContextual("as"), e3.local = this.parseIdent(), this.checkLValSimple(e3.local, 2), this.finishNode(e3, "ImportNamespaceSpecifier");
        }, L.parseImportSpecifiers = function() {
          var e3 = [], t3 = true;
          if (this.type === f.name && (e3.push(this.parseImportDefaultSpecifier()), !this.eat(f.comma))) return e3;
          if (this.type === f.star) return e3.push(this.parseImportNamespaceSpecifier()), e3;
          for (this.expect(f.braceL); !this.eat(f.braceR); ) {
            if (t3) t3 = false;
            else if (this.expect(f.comma), this.afterTrailingComma(f.braceR)) break;
            e3.push(this.parseImportSpecifier());
          }
          return e3;
        }, L.parseWithClause = function() {
          var e3 = [];
          if (!this.eat(f._with)) return e3;
          this.expect(f.braceL);
          for (var t3 = {}, i2 = true; !this.eat(f.braceR); ) {
            if (i2) i2 = false;
            else if (this.expect(f.comma), this.afterTrailingComma(f.braceR)) break;
            var s2 = this.parseImportAttribute(), r2 = "Identifier" === s2.key.type ? s2.key.name : s2.key.value;
            b(t3, r2) && this.raiseRecoverable(s2.key.start, "Duplicate attribute key '" + r2 + "'"), t3[r2] = true, e3.push(s2);
          }
          return e3;
        }, L.parseImportAttribute = function() {
          var e3 = this.startNode();
          return e3.key = this.type === f.string ? this.parseExprAtom() : this.parseIdent("never" !== this.options.allowReserved), this.expect(f.colon), this.type !== f.string && this.unexpected(), e3.value = this.parseExprAtom(), this.finishNode(e3, "ImportAttribute");
        }, L.parseModuleExportName = function() {
          if (this.options.ecmaVersion >= 13 && this.type === f.string) {
            var e3 = this.parseLiteral(this.value);
            return w.test(e3.value) && this.raise(e3.start, "An export name cannot include a lone surrogate."), e3;
          }
          return this.parseIdent(true);
        }, L.adaptDirectivePrologue = function(e3) {
          for (var t3 = 0; t3 < e3.length && this.isDirectiveCandidate(e3[t3]); ++t3) e3[t3].directive = e3[t3].expression.raw.slice(1, -1);
        }, L.isDirectiveCandidate = function(e3) {
          return this.options.ecmaVersion >= 5 && "ExpressionStatement" === e3.type && "Literal" === e3.expression.type && "string" == typeof e3.expression.value && ('"' === this.input[e3.start] || "'" === this.input[e3.start]);
        };
        var j = acorn_Parser.prototype;
        j.toAssignable = function(e3, t3, i2) {
          if (this.options.ecmaVersion >= 6 && e3) switch (e3.type) {
            case "Identifier":
              this.inAsync && "await" === e3.name && this.raise(e3.start, "Cannot use 'await' as identifier inside an async function");
              break;
            case "ObjectPattern":
            case "ArrayPattern":
            case "AssignmentPattern":
            case "RestElement":
              break;
            case "ObjectExpression":
              e3.type = "ObjectPattern", i2 && this.checkPatternErrors(i2, true);
              for (var s2 = 0, r2 = e3.properties; s2 < r2.length; s2 += 1) {
                var n2 = r2[s2];
                this.toAssignable(n2, t3), "RestElement" !== n2.type || "ArrayPattern" !== n2.argument.type && "ObjectPattern" !== n2.argument.type || this.raise(n2.argument.start, "Unexpected token");
              }
              break;
            case "Property":
              "init" !== e3.kind && this.raise(e3.key.start, "Object pattern can't contain getter or setter"), this.toAssignable(e3.value, t3);
              break;
            case "ArrayExpression":
              e3.type = "ArrayPattern", i2 && this.checkPatternErrors(i2, true), this.toAssignableList(e3.elements, t3);
              break;
            case "SpreadElement":
              e3.type = "RestElement", this.toAssignable(e3.argument, t3), "AssignmentPattern" === e3.argument.type && this.raise(e3.argument.start, "Rest elements cannot have a default value");
              break;
            case "AssignmentExpression":
              "=" !== e3.operator && this.raise(e3.left.end, "Only '=' operator can be used for specifying default value."), e3.type = "AssignmentPattern", delete e3.operator, this.toAssignable(e3.left, t3);
              break;
            case "ParenthesizedExpression":
              this.toAssignable(e3.expression, t3, i2);
              break;
            case "ChainExpression":
              this.raiseRecoverable(e3.start, "Optional chaining cannot appear in left-hand side");
              break;
            case "MemberExpression":
              if (!t3) break;
            default:
              this.raise(e3.start, "Assigning to rvalue");
          }
          else i2 && this.checkPatternErrors(i2, true);
          return e3;
        }, j.toAssignableList = function(e3, t3) {
          for (var i2 = e3.length, s2 = 0; s2 < i2; s2++) {
            var r2 = e3[s2];
            r2 && this.toAssignable(r2, t3);
          }
          if (i2) {
            var n2 = e3[i2 - 1];
            6 === this.options.ecmaVersion && t3 && n2 && "RestElement" === n2.type && "Identifier" !== n2.argument.type && this.unexpected(n2.argument.start);
          }
          return e3;
        }, j.parseSpread = function(e3) {
          var t3 = this.startNode();
          return this.next(), t3.argument = this.parseMaybeAssign(false, e3), this.finishNode(t3, "SpreadElement");
        }, j.parseRestBinding = function() {
          var e3 = this.startNode();
          return this.next(), 6 === this.options.ecmaVersion && this.type !== f.name && this.unexpected(), e3.argument = this.parseBindingAtom(), this.finishNode(e3, "RestElement");
        }, j.parseBindingAtom = function() {
          if (this.options.ecmaVersion >= 6) switch (this.type) {
            case f.bracketL:
              var e3 = this.startNode();
              return this.next(), e3.elements = this.parseBindingList(f.bracketR, true, true), this.finishNode(e3, "ArrayPattern");
            case f.braceL:
              return this.parseObj(true);
          }
          return this.parseIdent();
        }, j.parseBindingList = function(e3, t3, i2, s2) {
          for (var r2 = [], n2 = true; !this.eat(e3); ) if (n2 ? n2 = false : this.expect(f.comma), t3 && this.type === f.comma) r2.push(null);
          else {
            if (i2 && this.afterTrailingComma(e3)) break;
            if (this.type === f.ellipsis) {
              var a2 = this.parseRestBinding();
              this.parseBindingListItem(a2), r2.push(a2), this.type === f.comma && this.raiseRecoverable(this.start, "Comma is not permitted after the rest element"), this.expect(e3);
              break;
            }
            r2.push(this.parseAssignableListItem(s2));
          }
          return r2;
        }, j.parseAssignableListItem = function(e3) {
          var t3 = this.parseMaybeDefault(this.start, this.startLoc);
          return this.parseBindingListItem(t3), t3;
        }, j.parseBindingListItem = function(e3) {
          return e3;
        }, j.parseMaybeDefault = function(e3, t3, i2) {
          if (i2 = i2 || this.parseBindingAtom(), this.options.ecmaVersion < 6 || !this.eat(f.eq)) return i2;
          var s2 = this.startNodeAt(e3, t3);
          return s2.left = i2, s2.right = this.parseMaybeAssign(), this.finishNode(s2, "AssignmentPattern");
        }, j.checkLValSimple = function(e3, t3, i2) {
          void 0 === t3 && (t3 = 0);
          var s2 = 0 !== t3;
          switch (e3.type) {
            case "Identifier":
              this.strict && this.reservedWordsStrictBind.test(e3.name) && this.raiseRecoverable(e3.start, (s2 ? "Binding " : "Assigning to ") + e3.name + " in strict mode"), s2 && (2 === t3 && "let" === e3.name && this.raiseRecoverable(e3.start, "let is disallowed as a lexically bound name"), i2 && (b(i2, e3.name) && this.raiseRecoverable(e3.start, "Argument name clash"), i2[e3.name] = true), 5 !== t3 && this.declareName(e3.name, t3, e3.start));
              break;
            case "ChainExpression":
              this.raiseRecoverable(e3.start, "Optional chaining cannot appear in left-hand side");
              break;
            case "MemberExpression":
              s2 && this.raiseRecoverable(e3.start, "Binding member expression");
              break;
            case "ParenthesizedExpression":
              return s2 && this.raiseRecoverable(e3.start, "Binding parenthesized expression"), this.checkLValSimple(e3.expression, t3, i2);
            default:
              this.raise(e3.start, (s2 ? "Binding" : "Assigning to") + " rvalue");
          }
        }, j.checkLValPattern = function(e3, t3, i2) {
          switch (void 0 === t3 && (t3 = 0), e3.type) {
            case "ObjectPattern":
              for (var s2 = 0, r2 = e3.properties; s2 < r2.length; s2 += 1) {
                var n2 = r2[s2];
                this.checkLValInnerPattern(n2, t3, i2);
              }
              break;
            case "ArrayPattern":
              for (var a2 = 0, o2 = e3.elements; a2 < o2.length; a2 += 1) {
                var h2 = o2[a2];
                h2 && this.checkLValInnerPattern(h2, t3, i2);
              }
              break;
            default:
              this.checkLValSimple(e3, t3, i2);
          }
        }, j.checkLValInnerPattern = function(e3, t3, i2) {
          switch (void 0 === t3 && (t3 = 0), e3.type) {
            case "Property":
              this.checkLValInnerPattern(e3.value, t3, i2);
              break;
            case "AssignmentPattern":
              this.checkLValPattern(e3.left, t3, i2);
              break;
            case "RestElement":
              this.checkLValPattern(e3.argument, t3, i2);
              break;
            default:
              this.checkLValPattern(e3, t3, i2);
          }
        };
        var acorn_TokContext = function(e3, t3, i2, s2, r2) {
          this.token = e3, this.isExpr = !!t3, this.preserveSpace = !!i2, this.override = s2, this.generator = !!r2;
        }, F = { b_stat: new acorn_TokContext("{", false), b_expr: new acorn_TokContext("{", true), b_tmpl: new acorn_TokContext("${", false), p_stat: new acorn_TokContext("(", false), p_expr: new acorn_TokContext("(", true), q_tmpl: new acorn_TokContext("`", true, true, function(e3) {
          return e3.tryReadTemplateToken();
        }), f_stat: new acorn_TokContext("function", false), f_expr: new acorn_TokContext("function", true), f_expr_gen: new acorn_TokContext("function", true, false, null, true), f_gen: new acorn_TokContext("function", false, false, null, true) }, B = acorn_Parser.prototype;
        B.initialContext = function() {
          return [F.b_stat];
        }, B.curContext = function() {
          return this.context[this.context.length - 1];
        }, B.braceIsBlock = function(e3) {
          var t3 = this.curContext();
          return t3 === F.f_expr || t3 === F.f_stat || (e3 !== f.colon || t3 !== F.b_stat && t3 !== F.b_expr ? e3 === f._return || e3 === f.name && this.exprAllowed ? m.test(this.input.slice(this.lastTokEnd, this.start)) : e3 === f._else || e3 === f.semi || e3 === f.eof || e3 === f.parenR || e3 === f.arrow || (e3 === f.braceL ? t3 === F.b_stat : e3 !== f._var && e3 !== f._const && e3 !== f.name && !this.exprAllowed) : !t3.isExpr);
        }, B.inGeneratorContext = function() {
          for (var e3 = this.context.length - 1; e3 >= 1; e3--) {
            var t3 = this.context[e3];
            if ("function" === t3.token) return t3.generator;
          }
          return false;
        }, B.updateContext = function(e3) {
          var t3, i2 = this.type;
          i2.keyword && e3 === f.dot ? this.exprAllowed = false : (t3 = i2.updateContext) ? t3.call(this, e3) : this.exprAllowed = i2.beforeExpr;
        }, B.overrideContext = function(e3) {
          this.curContext() !== e3 && (this.context[this.context.length - 1] = e3);
        }, f.parenR.updateContext = f.braceR.updateContext = function() {
          if (1 !== this.context.length) {
            var e3 = this.context.pop();
            e3 === F.b_stat && "function" === this.curContext().token && (e3 = this.context.pop()), this.exprAllowed = !e3.isExpr;
          } else this.exprAllowed = true;
        }, f.braceL.updateContext = function(e3) {
          this.context.push(this.braceIsBlock(e3) ? F.b_stat : F.b_expr), this.exprAllowed = true;
        }, f.dollarBraceL.updateContext = function() {
          this.context.push(F.b_tmpl), this.exprAllowed = true;
        }, f.parenL.updateContext = function(e3) {
          var t3 = e3 === f._if || e3 === f._for || e3 === f._with || e3 === f._while;
          this.context.push(t3 ? F.p_stat : F.p_expr), this.exprAllowed = true;
        }, f.incDec.updateContext = function() {
        }, f._function.updateContext = f._class.updateContext = function(e3) {
          !e3.beforeExpr || e3 === f._else || e3 === f.semi && this.curContext() !== F.p_stat || e3 === f._return && m.test(this.input.slice(this.lastTokEnd, this.start)) || (e3 === f.colon || e3 === f.braceL) && this.curContext() === F.b_stat ? this.context.push(F.f_stat) : this.context.push(F.f_expr), this.exprAllowed = false;
        }, f.colon.updateContext = function() {
          "function" === this.curContext().token && this.context.pop(), this.exprAllowed = true;
        }, f.backQuote.updateContext = function() {
          this.curContext() === F.q_tmpl ? this.context.pop() : this.context.push(F.q_tmpl), this.exprAllowed = false;
        }, f.star.updateContext = function(e3) {
          if (e3 === f._function) {
            var t3 = this.context.length - 1;
            this.context[t3] === F.f_expr ? this.context[t3] = F.f_expr_gen : this.context[t3] = F.f_gen;
          }
          this.exprAllowed = true;
        }, f.name.updateContext = function(e3) {
          var t3 = false;
          this.options.ecmaVersion >= 6 && e3 !== f.dot && ("of" === this.value && !this.exprAllowed || "yield" === this.value && this.inGeneratorContext()) && (t3 = true), this.exprAllowed = t3;
        };
        var $ = acorn_Parser.prototype;
        function isLocalVariableAccess(e3) {
          return "Identifier" === e3.type || "ParenthesizedExpression" === e3.type && isLocalVariableAccess(e3.expression);
        }
        function isPrivateFieldAccess(e3) {
          return "MemberExpression" === e3.type && "PrivateIdentifier" === e3.property.type || "ChainExpression" === e3.type && isPrivateFieldAccess(e3.expression) || "ParenthesizedExpression" === e3.type && isPrivateFieldAccess(e3.expression);
        }
        $.checkPropClash = function(e3, t3, i2) {
          if (!(this.options.ecmaVersion >= 9 && "SpreadElement" === e3.type || this.options.ecmaVersion >= 6 && (e3.computed || e3.method || e3.shorthand))) {
            var s2, r2 = e3.key;
            switch (r2.type) {
              case "Identifier":
                s2 = r2.name;
                break;
              case "Literal":
                s2 = String(r2.value);
                break;
              default:
                return;
            }
            var n2 = e3.kind;
            if (this.options.ecmaVersion >= 6) "__proto__" === s2 && "init" === n2 && (t3.proto && (i2 ? i2.doubleProto < 0 && (i2.doubleProto = r2.start) : this.raiseRecoverable(r2.start, "Redefinition of __proto__ property")), t3.proto = true);
            else {
              var a2 = t3[s2 = "$" + s2];
              if (a2) ("init" === n2 ? this.strict && a2.init || a2.get || a2.set : a2.init || a2[n2]) && this.raiseRecoverable(r2.start, "Redefinition of property");
              else a2 = t3[s2] = { init: false, get: false, set: false };
              a2[n2] = true;
            }
          }
        }, $.parseExpression = function(e3, t3) {
          var i2 = this.start, s2 = this.startLoc, r2 = this.parseMaybeAssign(e3, t3);
          if (this.type === f.comma) {
            var n2 = this.startNodeAt(i2, s2);
            for (n2.expressions = [r2]; this.eat(f.comma); ) n2.expressions.push(this.parseMaybeAssign(e3, t3));
            return this.finishNode(n2, "SequenceExpression");
          }
          return r2;
        }, $.parseMaybeAssign = function(e3, t3, i2) {
          if (this.isContextual("yield")) {
            if (this.inGenerator) return this.parseYield(e3);
            this.exprAllowed = false;
          }
          var s2 = false, r2 = -1, n2 = -1, a2 = -1;
          t3 ? (r2 = t3.parenthesizedAssign, n2 = t3.trailingComma, a2 = t3.doubleProto, t3.parenthesizedAssign = t3.trailingComma = -1) : (t3 = new acorn_DestructuringErrors(), s2 = true);
          var o2 = this.start, h2 = this.startLoc;
          this.type !== f.parenL && this.type !== f.name || (this.potentialArrowAt = this.start, this.potentialArrowInForAwait = "await" === e3);
          var c2 = this.parseMaybeConditional(e3, t3);
          if (i2 && (c2 = i2.call(this, c2, o2, h2)), this.type.isAssign) {
            var p2 = this.startNodeAt(o2, h2);
            return p2.operator = this.value, this.type === f.eq && (c2 = this.toAssignable(c2, false, t3)), s2 || (t3.parenthesizedAssign = t3.trailingComma = t3.doubleProto = -1), t3.shorthandAssign >= c2.start && (t3.shorthandAssign = -1), this.type === f.eq ? this.checkLValPattern(c2) : this.checkLValSimple(c2), p2.left = c2, this.next(), p2.right = this.parseMaybeAssign(e3), a2 > -1 && (t3.doubleProto = a2), this.finishNode(p2, "AssignmentExpression");
          }
          return s2 && this.checkExpressionErrors(t3, true), r2 > -1 && (t3.parenthesizedAssign = r2), n2 > -1 && (t3.trailingComma = n2), c2;
        }, $.parseMaybeConditional = function(e3, t3) {
          var i2 = this.start, s2 = this.startLoc, r2 = this.parseExprOps(e3, t3);
          if (this.checkExpressionErrors(t3)) return r2;
          if (this.eat(f.question)) {
            var n2 = this.startNodeAt(i2, s2);
            return n2.test = r2, n2.consequent = this.parseMaybeAssign(), this.expect(f.colon), n2.alternate = this.parseMaybeAssign(e3), this.finishNode(n2, "ConditionalExpression");
          }
          return r2;
        }, $.parseExprOps = function(e3, t3) {
          var i2 = this.start, s2 = this.startLoc, r2 = this.parseMaybeUnary(t3, false, false, e3);
          return this.checkExpressionErrors(t3) || r2.start === i2 && "ArrowFunctionExpression" === r2.type ? r2 : this.parseExprOp(r2, i2, s2, -1, e3);
        }, $.parseExprOp = function(e3, t3, i2, s2, r2) {
          var n2 = this.type.binop;
          if (null != n2 && (!r2 || this.type !== f._in) && n2 > s2) {
            var a2 = this.type === f.logicalOR || this.type === f.logicalAND, o2 = this.type === f.coalesce;
            o2 && (n2 = f.logicalAND.binop);
            var h2 = this.value;
            this.next();
            var c2 = this.start, p2 = this.startLoc, l2 = this.parseExprOp(this.parseMaybeUnary(null, false, false, r2), c2, p2, n2, r2), u2 = this.buildBinary(t3, i2, e3, l2, h2, a2 || o2);
            return (a2 && this.type === f.coalesce || o2 && (this.type === f.logicalOR || this.type === f.logicalAND)) && this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses"), this.parseExprOp(u2, t3, i2, s2, r2);
          }
          return e3;
        }, $.buildBinary = function(e3, t3, i2, s2, r2, n2) {
          "PrivateIdentifier" === s2.type && this.raise(s2.start, "Private identifier can only be left side of binary expression");
          var a2 = this.startNodeAt(e3, t3);
          return a2.left = i2, a2.operator = r2, a2.right = s2, this.finishNode(a2, n2 ? "LogicalExpression" : "BinaryExpression");
        }, $.parseMaybeUnary = function(e3, t3, i2, s2) {
          var r2, n2 = this.start, a2 = this.startLoc;
          if (this.isContextual("await") && this.canAwait) r2 = this.parseAwait(s2), t3 = true;
          else if (this.type.prefix) {
            var o2 = this.startNode(), h2 = this.type === f.incDec;
            o2.operator = this.value, o2.prefix = true, this.next(), o2.argument = this.parseMaybeUnary(null, true, h2, s2), this.checkExpressionErrors(e3, true), h2 ? this.checkLValSimple(o2.argument) : this.strict && "delete" === o2.operator && isLocalVariableAccess(o2.argument) ? this.raiseRecoverable(o2.start, "Deleting local variable in strict mode") : "delete" === o2.operator && isPrivateFieldAccess(o2.argument) ? this.raiseRecoverable(o2.start, "Private fields can not be deleted") : t3 = true, r2 = this.finishNode(o2, h2 ? "UpdateExpression" : "UnaryExpression");
          } else if (t3 || this.type !== f.privateId) {
            if (r2 = this.parseExprSubscripts(e3, s2), this.checkExpressionErrors(e3)) return r2;
            for (; this.type.postfix && !this.canInsertSemicolon(); ) {
              var c2 = this.startNodeAt(n2, a2);
              c2.operator = this.value, c2.prefix = false, c2.argument = r2, this.checkLValSimple(r2), this.next(), r2 = this.finishNode(c2, "UpdateExpression");
            }
          } else (s2 || 0 === this.privateNameStack.length) && this.options.checkPrivateFields && this.unexpected(), r2 = this.parsePrivateIdent(), this.type !== f._in && this.unexpected();
          return i2 || !this.eat(f.starstar) ? r2 : t3 ? void this.unexpected(this.lastTokStart) : this.buildBinary(n2, a2, r2, this.parseMaybeUnary(null, false, false, s2), "**", false);
        }, $.parseExprSubscripts = function(e3, t3) {
          var i2 = this.start, s2 = this.startLoc, r2 = this.parseExprAtom(e3, t3);
          if ("ArrowFunctionExpression" === r2.type && ")" !== this.input.slice(this.lastTokStart, this.lastTokEnd)) return r2;
          var n2 = this.parseSubscripts(r2, i2, s2, false, t3);
          return e3 && "MemberExpression" === n2.type && (e3.parenthesizedAssign >= n2.start && (e3.parenthesizedAssign = -1), e3.parenthesizedBind >= n2.start && (e3.parenthesizedBind = -1), e3.trailingComma >= n2.start && (e3.trailingComma = -1)), n2;
        }, $.parseSubscripts = function(e3, t3, i2, s2, r2) {
          for (var n2 = this.options.ecmaVersion >= 8 && "Identifier" === e3.type && "async" === e3.name && this.lastTokEnd === e3.end && !this.canInsertSemicolon() && e3.end - e3.start === 5 && this.potentialArrowAt === e3.start, a2 = false; ; ) {
            var o2 = this.parseSubscript(e3, t3, i2, s2, n2, a2, r2);
            if (o2.optional && (a2 = true), o2 === e3 || "ArrowFunctionExpression" === o2.type) {
              if (a2) {
                var h2 = this.startNodeAt(t3, i2);
                h2.expression = o2, o2 = this.finishNode(h2, "ChainExpression");
              }
              return o2;
            }
            e3 = o2;
          }
        }, $.shouldParseAsyncArrow = function() {
          return !this.canInsertSemicolon() && this.eat(f.arrow);
        }, $.parseSubscriptAsyncArrow = function(e3, t3, i2, s2) {
          return this.parseArrowExpression(this.startNodeAt(e3, t3), i2, true, s2);
        }, $.parseSubscript = function(e3, t3, i2, s2, r2, n2, a2) {
          var o2 = this.options.ecmaVersion >= 11, h2 = o2 && this.eat(f.questionDot);
          s2 && h2 && this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions");
          var c2 = this.eat(f.bracketL);
          if (c2 || h2 && this.type !== f.parenL && this.type !== f.backQuote || this.eat(f.dot)) {
            var p2 = this.startNodeAt(t3, i2);
            p2.object = e3, c2 ? (p2.property = this.parseExpression(), this.expect(f.bracketR)) : this.type === f.privateId && "Super" !== e3.type ? p2.property = this.parsePrivateIdent() : p2.property = this.parseIdent("never" !== this.options.allowReserved), p2.computed = !!c2, o2 && (p2.optional = h2), e3 = this.finishNode(p2, "MemberExpression");
          } else if (!s2 && this.eat(f.parenL)) {
            var l2 = new acorn_DestructuringErrors(), u2 = this.yieldPos, d2 = this.awaitPos, m2 = this.awaitIdentPos;
            this.yieldPos = 0, this.awaitPos = 0, this.awaitIdentPos = 0;
            var g2 = this.parseExprList(f.parenR, this.options.ecmaVersion >= 8, false, l2);
            if (r2 && !h2 && this.shouldParseAsyncArrow()) return this.checkPatternErrors(l2, false), this.checkYieldAwaitInDefaultParams(), this.awaitIdentPos > 0 && this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function"), this.yieldPos = u2, this.awaitPos = d2, this.awaitIdentPos = m2, this.parseSubscriptAsyncArrow(t3, i2, g2, a2);
            this.checkExpressionErrors(l2, true), this.yieldPos = u2 || this.yieldPos, this.awaitPos = d2 || this.awaitPos, this.awaitIdentPos = m2 || this.awaitIdentPos;
            var x2 = this.startNodeAt(t3, i2);
            x2.callee = e3, x2.arguments = g2, o2 && (x2.optional = h2), e3 = this.finishNode(x2, "CallExpression");
          } else if (this.type === f.backQuote) {
            (h2 || n2) && this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
            var v2 = this.startNodeAt(t3, i2);
            v2.tag = e3, v2.quasi = this.parseTemplate({ isTagged: true }), e3 = this.finishNode(v2, "TaggedTemplateExpression");
          }
          return e3;
        }, $.parseExprAtom = function(e3, t3, i2) {
          this.type === f.slash && this.readRegexp();
          var s2, r2 = this.potentialArrowAt === this.start;
          switch (this.type) {
            case f._super:
              return this.allowSuper || this.raise(this.start, "'super' keyword outside a method"), s2 = this.startNode(), this.next(), this.type !== f.parenL || this.allowDirectSuper || this.raise(s2.start, "super() call outside constructor of a subclass"), this.type !== f.dot && this.type !== f.bracketL && this.type !== f.parenL && this.unexpected(), this.finishNode(s2, "Super");
            case f._this:
              return s2 = this.startNode(), this.next(), this.finishNode(s2, "ThisExpression");
            case f.name:
              var n2 = this.start, a2 = this.startLoc, o2 = this.containsEsc, h2 = this.parseIdent(false);
              if (this.options.ecmaVersion >= 8 && !o2 && "async" === h2.name && !this.canInsertSemicolon() && this.eat(f._function)) return this.overrideContext(F.f_expr), this.parseFunction(this.startNodeAt(n2, a2), 0, false, true, t3);
              if (r2 && !this.canInsertSemicolon()) {
                if (this.eat(f.arrow)) return this.parseArrowExpression(this.startNodeAt(n2, a2), [h2], false, t3);
                if (this.options.ecmaVersion >= 8 && "async" === h2.name && this.type === f.name && !o2 && (!this.potentialArrowInForAwait || "of" !== this.value || this.containsEsc)) return h2 = this.parseIdent(false), !this.canInsertSemicolon() && this.eat(f.arrow) || this.unexpected(), this.parseArrowExpression(this.startNodeAt(n2, a2), [h2], true, t3);
              }
              return h2;
            case f.regexp:
              var c2 = this.value;
              return (s2 = this.parseLiteral(c2.value)).regex = { pattern: c2.pattern, flags: c2.flags }, s2;
            case f.num:
            case f.string:
              return this.parseLiteral(this.value);
            case f._null:
            case f._true:
            case f._false:
              return (s2 = this.startNode()).value = this.type === f._null ? null : this.type === f._true, s2.raw = this.type.keyword, this.next(), this.finishNode(s2, "Literal");
            case f.parenL:
              var p2 = this.start, l2 = this.parseParenAndDistinguishExpression(r2, t3);
              return e3 && (e3.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(l2) && (e3.parenthesizedAssign = p2), e3.parenthesizedBind < 0 && (e3.parenthesizedBind = p2)), l2;
            case f.bracketL:
              return s2 = this.startNode(), this.next(), s2.elements = this.parseExprList(f.bracketR, true, true, e3), this.finishNode(s2, "ArrayExpression");
            case f.braceL:
              return this.overrideContext(F.b_expr), this.parseObj(false, e3);
            case f._function:
              return s2 = this.startNode(), this.next(), this.parseFunction(s2, 0);
            case f._class:
              return this.parseClass(this.startNode(), false);
            case f._new:
              return this.parseNew();
            case f.backQuote:
              return this.parseTemplate();
            case f._import:
              return this.options.ecmaVersion >= 11 ? this.parseExprImport(i2) : this.unexpected();
            default:
              return this.parseExprAtomDefault();
          }
        }, $.parseExprAtomDefault = function() {
          this.unexpected();
        }, $.parseExprImport = function(e3) {
          var t3 = this.startNode();
          if (this.containsEsc && this.raiseRecoverable(this.start, "Escape sequence in keyword import"), this.next(), this.type === f.parenL && !e3) return this.parseDynamicImport(t3);
          if (this.type === f.dot) {
            var i2 = this.startNodeAt(t3.start, t3.loc && t3.loc.start);
            return i2.name = "import", t3.meta = this.finishNode(i2, "Identifier"), this.parseImportMeta(t3);
          }
          this.unexpected();
        }, $.parseDynamicImport = function(e3) {
          if (this.next(), e3.source = this.parseMaybeAssign(), this.options.ecmaVersion >= 16) this.eat(f.parenR) ? e3.options = null : (this.expect(f.comma), this.afterTrailingComma(f.parenR) ? e3.options = null : (e3.options = this.parseMaybeAssign(), this.eat(f.parenR) || (this.expect(f.comma), this.afterTrailingComma(f.parenR) || this.unexpected())));
          else if (!this.eat(f.parenR)) {
            var t3 = this.start;
            this.eat(f.comma) && this.eat(f.parenR) ? this.raiseRecoverable(t3, "Trailing comma is not allowed in import()") : this.unexpected(t3);
          }
          return this.finishNode(e3, "ImportExpression");
        }, $.parseImportMeta = function(e3) {
          this.next();
          var t3 = this.containsEsc;
          return e3.property = this.parseIdent(true), "meta" !== e3.property.name && this.raiseRecoverable(e3.property.start, "The only valid meta property for import is 'import.meta'"), t3 && this.raiseRecoverable(e3.start, "'import.meta' must not contain escaped characters"), "module" === this.options.sourceType || this.options.allowImportExportEverywhere || this.raiseRecoverable(e3.start, "Cannot use 'import.meta' outside a module"), this.finishNode(e3, "MetaProperty");
        }, $.parseLiteral = function(e3) {
          var t3 = this.startNode();
          return t3.value = e3, t3.raw = this.input.slice(this.start, this.end), 110 === t3.raw.charCodeAt(t3.raw.length - 1) && (t3.bigint = null != t3.value ? t3.value.toString() : t3.raw.slice(0, -1).replace(/_/g, "")), this.next(), this.finishNode(t3, "Literal");
        }, $.parseParenExpression = function() {
          this.expect(f.parenL);
          var e3 = this.parseExpression();
          return this.expect(f.parenR), e3;
        }, $.shouldParseArrow = function(e3) {
          return !this.canInsertSemicolon();
        }, $.parseParenAndDistinguishExpression = function(e3, t3) {
          var i2, s2 = this.start, r2 = this.startLoc, n2 = this.options.ecmaVersion >= 8;
          if (this.options.ecmaVersion >= 6) {
            this.next();
            var a2, o2 = this.start, h2 = this.startLoc, c2 = [], p2 = true, l2 = false, u2 = new acorn_DestructuringErrors(), d2 = this.yieldPos, m2 = this.awaitPos;
            for (this.yieldPos = 0, this.awaitPos = 0; this.type !== f.parenR; ) {
              if (p2 ? p2 = false : this.expect(f.comma), n2 && this.afterTrailingComma(f.parenR, true)) {
                l2 = true;
                break;
              }
              if (this.type === f.ellipsis) {
                a2 = this.start, c2.push(this.parseParenItem(this.parseRestBinding())), this.type === f.comma && this.raiseRecoverable(this.start, "Comma is not permitted after the rest element");
                break;
              }
              c2.push(this.parseMaybeAssign(false, u2, this.parseParenItem));
            }
            var g2 = this.lastTokEnd, x2 = this.lastTokEndLoc;
            if (this.expect(f.parenR), e3 && this.shouldParseArrow(c2) && this.eat(f.arrow)) return this.checkPatternErrors(u2, false), this.checkYieldAwaitInDefaultParams(), this.yieldPos = d2, this.awaitPos = m2, this.parseParenArrowList(s2, r2, c2, t3);
            c2.length && !l2 || this.unexpected(this.lastTokStart), a2 && this.unexpected(a2), this.checkExpressionErrors(u2, true), this.yieldPos = d2 || this.yieldPos, this.awaitPos = m2 || this.awaitPos, c2.length > 1 ? ((i2 = this.startNodeAt(o2, h2)).expressions = c2, this.finishNodeAt(i2, "SequenceExpression", g2, x2)) : i2 = c2[0];
          } else i2 = this.parseParenExpression();
          if (this.options.preserveParens) {
            var v2 = this.startNodeAt(s2, r2);
            return v2.expression = i2, this.finishNode(v2, "ParenthesizedExpression");
          }
          return i2;
        }, $.parseParenItem = function(e3) {
          return e3;
        }, $.parseParenArrowList = function(e3, t3, i2, s2) {
          return this.parseArrowExpression(this.startNodeAt(e3, t3), i2, false, s2);
        };
        var q = [];
        $.parseNew = function() {
          this.containsEsc && this.raiseRecoverable(this.start, "Escape sequence in keyword new");
          var e3 = this.startNode();
          if (this.next(), this.options.ecmaVersion >= 6 && this.type === f.dot) {
            var t3 = this.startNodeAt(e3.start, e3.loc && e3.loc.start);
            t3.name = "new", e3.meta = this.finishNode(t3, "Identifier"), this.next();
            var i2 = this.containsEsc;
            return e3.property = this.parseIdent(true), "target" !== e3.property.name && this.raiseRecoverable(e3.property.start, "The only valid meta property for new is 'new.target'"), i2 && this.raiseRecoverable(e3.start, "'new.target' must not contain escaped characters"), this.allowNewDotTarget || this.raiseRecoverable(e3.start, "'new.target' can only be used in functions and class static block"), this.finishNode(e3, "MetaProperty");
          }
          var s2 = this.start, r2 = this.startLoc;
          return e3.callee = this.parseSubscripts(this.parseExprAtom(null, false, true), s2, r2, true, false), this.eat(f.parenL) ? e3.arguments = this.parseExprList(f.parenR, this.options.ecmaVersion >= 8, false) : e3.arguments = q, this.finishNode(e3, "NewExpression");
        }, $.parseTemplateElement = function(e3) {
          var t3 = e3.isTagged, i2 = this.startNode();
          return this.type === f.invalidTemplate ? (t3 || this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal"), i2.value = { raw: this.value.replace(/\r\n?/g, "\n"), cooked: null }) : i2.value = { raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"), cooked: this.value }, this.next(), i2.tail = this.type === f.backQuote, this.finishNode(i2, "TemplateElement");
        }, $.parseTemplate = function(e3) {
          void 0 === e3 && (e3 = {});
          var t3 = e3.isTagged;
          void 0 === t3 && (t3 = false);
          var i2 = this.startNode();
          this.next(), i2.expressions = [];
          var s2 = this.parseTemplateElement({ isTagged: t3 });
          for (i2.quasis = [s2]; !s2.tail; ) this.type === f.eof && this.raise(this.pos, "Unterminated template literal"), this.expect(f.dollarBraceL), i2.expressions.push(this.parseExpression()), this.expect(f.braceR), i2.quasis.push(s2 = this.parseTemplateElement({ isTagged: t3 }));
          return this.next(), this.finishNode(i2, "TemplateLiteral");
        }, $.isAsyncProp = function(e3) {
          return !e3.computed && "Identifier" === e3.key.type && "async" === e3.key.name && (this.type === f.name || this.type === f.num || this.type === f.string || this.type === f.bracketL || this.type.keyword || this.options.ecmaVersion >= 9 && this.type === f.star) && !m.test(this.input.slice(this.lastTokEnd, this.start));
        }, $.parseObj = function(e3, t3) {
          var i2 = this.startNode(), s2 = true, r2 = {};
          for (i2.properties = [], this.next(); !this.eat(f.braceR); ) {
            if (s2) s2 = false;
            else if (this.expect(f.comma), this.options.ecmaVersion >= 5 && this.afterTrailingComma(f.braceR)) break;
            var n2 = this.parseProperty(e3, t3);
            e3 || this.checkPropClash(n2, r2, t3), i2.properties.push(n2);
          }
          return this.finishNode(i2, e3 ? "ObjectPattern" : "ObjectExpression");
        }, $.parseProperty = function(e3, t3) {
          var i2, s2, r2, n2, a2 = this.startNode();
          if (this.options.ecmaVersion >= 9 && this.eat(f.ellipsis)) return e3 ? (a2.argument = this.parseIdent(false), this.type === f.comma && this.raiseRecoverable(this.start, "Comma is not permitted after the rest element"), this.finishNode(a2, "RestElement")) : (a2.argument = this.parseMaybeAssign(false, t3), this.type === f.comma && t3 && t3.trailingComma < 0 && (t3.trailingComma = this.start), this.finishNode(a2, "SpreadElement"));
          this.options.ecmaVersion >= 6 && (a2.method = false, a2.shorthand = false, (e3 || t3) && (r2 = this.start, n2 = this.startLoc), e3 || (i2 = this.eat(f.star)));
          var o2 = this.containsEsc;
          return this.parsePropertyName(a2), !e3 && !o2 && this.options.ecmaVersion >= 8 && !i2 && this.isAsyncProp(a2) ? (s2 = true, i2 = this.options.ecmaVersion >= 9 && this.eat(f.star), this.parsePropertyName(a2)) : s2 = false, this.parsePropertyValue(a2, e3, i2, s2, r2, n2, t3, o2), this.finishNode(a2, "Property");
        }, $.parseGetterSetter = function(e3) {
          var t3 = e3.key.name;
          this.parsePropertyName(e3), e3.value = this.parseMethod(false), e3.kind = t3;
          var i2 = "get" === e3.kind ? 0 : 1;
          if (e3.value.params.length !== i2) {
            var s2 = e3.value.start;
            "get" === e3.kind ? this.raiseRecoverable(s2, "getter should have no params") : this.raiseRecoverable(s2, "setter should have exactly one param");
          } else "set" === e3.kind && "RestElement" === e3.value.params[0].type && this.raiseRecoverable(e3.value.params[0].start, "Setter cannot use rest params");
        }, $.parsePropertyValue = function(e3, t3, i2, s2, r2, n2, a2, o2) {
          (i2 || s2) && this.type === f.colon && this.unexpected(), this.eat(f.colon) ? (e3.value = t3 ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, a2), e3.kind = "init") : this.options.ecmaVersion >= 6 && this.type === f.parenL ? (t3 && this.unexpected(), e3.method = true, e3.value = this.parseMethod(i2, s2), e3.kind = "init") : t3 || o2 || !(this.options.ecmaVersion >= 5) || e3.computed || "Identifier" !== e3.key.type || "get" !== e3.key.name && "set" !== e3.key.name || this.type === f.comma || this.type === f.braceR || this.type === f.eq ? this.options.ecmaVersion >= 6 && !e3.computed && "Identifier" === e3.key.type ? ((i2 || s2) && this.unexpected(), this.checkUnreserved(e3.key), "await" !== e3.key.name || this.awaitIdentPos || (this.awaitIdentPos = r2), t3 ? e3.value = this.parseMaybeDefault(r2, n2, this.copyNode(e3.key)) : this.type === f.eq && a2 ? (a2.shorthandAssign < 0 && (a2.shorthandAssign = this.start), e3.value = this.parseMaybeDefault(r2, n2, this.copyNode(e3.key))) : e3.value = this.copyNode(e3.key), e3.kind = "init", e3.shorthand = true) : this.unexpected() : ((i2 || s2) && this.unexpected(), this.parseGetterSetter(e3));
        }, $.parsePropertyName = function(e3) {
          if (this.options.ecmaVersion >= 6) {
            if (this.eat(f.bracketL)) return e3.computed = true, e3.key = this.parseMaybeAssign(), this.expect(f.bracketR), e3.key;
            e3.computed = false;
          }
          return e3.key = this.type === f.num || this.type === f.string ? this.parseExprAtom() : this.parseIdent("never" !== this.options.allowReserved);
        }, $.initFunction = function(e3) {
          e3.id = null, this.options.ecmaVersion >= 6 && (e3.generator = e3.expression = false), this.options.ecmaVersion >= 8 && (e3.async = false);
        }, $.parseMethod = function(e3, t3, i2) {
          var s2 = this.startNode(), r2 = this.yieldPos, n2 = this.awaitPos, a2 = this.awaitIdentPos;
          return this.initFunction(s2), this.options.ecmaVersion >= 6 && (s2.generator = e3), this.options.ecmaVersion >= 8 && (s2.async = !!t3), this.yieldPos = 0, this.awaitPos = 0, this.awaitIdentPos = 0, this.enterScope(64 | functionFlags(t3, s2.generator) | (i2 ? 128 : 0)), this.expect(f.parenL), s2.params = this.parseBindingList(f.parenR, false, this.options.ecmaVersion >= 8), this.checkYieldAwaitInDefaultParams(), this.parseFunctionBody(s2, false, true, false), this.yieldPos = r2, this.awaitPos = n2, this.awaitIdentPos = a2, this.finishNode(s2, "FunctionExpression");
        }, $.parseArrowExpression = function(e3, t3, i2, s2) {
          var r2 = this.yieldPos, n2 = this.awaitPos, a2 = this.awaitIdentPos;
          return this.enterScope(16 | functionFlags(i2, false)), this.initFunction(e3), this.options.ecmaVersion >= 8 && (e3.async = !!i2), this.yieldPos = 0, this.awaitPos = 0, this.awaitIdentPos = 0, e3.params = this.toAssignableList(t3, true), this.parseFunctionBody(e3, true, false, s2), this.yieldPos = r2, this.awaitPos = n2, this.awaitIdentPos = a2, this.finishNode(e3, "ArrowFunctionExpression");
        }, $.parseFunctionBody = function(e3, t3, i2, s2) {
          var r2 = t3 && this.type !== f.braceL, n2 = this.strict, a2 = false;
          if (r2) e3.body = this.parseMaybeAssign(s2), e3.expression = true, this.checkParams(e3, false);
          else {
            var o2 = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(e3.params);
            n2 && !o2 || (a2 = this.strictDirective(this.end)) && o2 && this.raiseRecoverable(e3.start, "Illegal 'use strict' directive in function with non-simple parameter list");
            var h2 = this.labels;
            this.labels = [], a2 && (this.strict = true), this.checkParams(e3, !n2 && !a2 && !t3 && !i2 && this.isSimpleParamList(e3.params)), this.strict && e3.id && this.checkLValSimple(e3.id, 5), e3.body = this.parseBlock(false, void 0, a2 && !n2), e3.expression = false, this.adaptDirectivePrologue(e3.body.body), this.labels = h2;
          }
          this.exitScope();
        }, $.isSimpleParamList = function(e3) {
          for (var t3 = 0, i2 = e3; t3 < i2.length; t3 += 1) {
            if ("Identifier" !== i2[t3].type) return false;
          }
          return true;
        }, $.checkParams = function(e3, t3) {
          for (var i2 = /* @__PURE__ */ Object.create(null), s2 = 0, r2 = e3.params; s2 < r2.length; s2 += 1) {
            var n2 = r2[s2];
            this.checkLValInnerPattern(n2, 1, t3 ? null : i2);
          }
        }, $.parseExprList = function(e3, t3, i2, s2) {
          for (var r2 = [], n2 = true; !this.eat(e3); ) {
            if (n2) n2 = false;
            else if (this.expect(f.comma), t3 && this.afterTrailingComma(e3)) break;
            var a2 = void 0;
            i2 && this.type === f.comma ? a2 = null : this.type === f.ellipsis ? (a2 = this.parseSpread(s2), s2 && this.type === f.comma && s2.trailingComma < 0 && (s2.trailingComma = this.start)) : a2 = this.parseMaybeAssign(false, s2), r2.push(a2);
          }
          return r2;
        }, $.checkUnreserved = function(e3) {
          var t3 = e3.start, i2 = e3.end, s2 = e3.name;
          (this.inGenerator && "yield" === s2 && this.raiseRecoverable(t3, "Cannot use 'yield' as identifier inside a generator"), this.inAsync && "await" === s2 && this.raiseRecoverable(t3, "Cannot use 'await' as identifier inside an async function"), this.currentThisScope().flags & P || "arguments" !== s2 || this.raiseRecoverable(t3, "Cannot use 'arguments' in class field initializer"), !this.inClassStaticBlock || "arguments" !== s2 && "await" !== s2 || this.raise(t3, "Cannot use " + s2 + " in class static initialization block"), this.keywords.test(s2) && this.raise(t3, "Unexpected keyword '" + s2 + "'"), this.options.ecmaVersion < 6 && -1 !== this.input.slice(t3, i2).indexOf("\\")) || (this.strict ? this.reservedWordsStrict : this.reservedWords).test(s2) && (this.inAsync || "await" !== s2 || this.raiseRecoverable(t3, "Cannot use keyword 'await' outside an async function"), this.raiseRecoverable(t3, "The keyword '" + s2 + "' is reserved"));
        }, $.parseIdent = function(e3) {
          var t3 = this.parseIdentNode();
          return this.next(!!e3), this.finishNode(t3, "Identifier"), e3 || (this.checkUnreserved(t3), "await" !== t3.name || this.awaitIdentPos || (this.awaitIdentPos = t3.start)), t3;
        }, $.parseIdentNode = function() {
          var e3 = this.startNode();
          return this.type === f.name ? e3.name = this.value : this.type.keyword ? (e3.name = this.type.keyword, "class" !== e3.name && "function" !== e3.name || this.lastTokEnd === this.lastTokStart + 1 && 46 === this.input.charCodeAt(this.lastTokStart) || this.context.pop(), this.type = f.name) : this.unexpected(), e3;
        }, $.parsePrivateIdent = function() {
          var e3 = this.startNode();
          return this.type === f.privateId ? e3.name = this.value : this.unexpected(), this.next(), this.finishNode(e3, "PrivateIdentifier"), this.options.checkPrivateFields && (0 === this.privateNameStack.length ? this.raise(e3.start, "Private field '#" + e3.name + "' must be declared in an enclosing class") : this.privateNameStack[this.privateNameStack.length - 1].used.push(e3)), e3;
        }, $.parseYield = function(e3) {
          this.yieldPos || (this.yieldPos = this.start);
          var t3 = this.startNode();
          return this.next(), this.type === f.semi || this.canInsertSemicolon() || this.type !== f.star && !this.type.startsExpr ? (t3.delegate = false, t3.argument = null) : (t3.delegate = this.eat(f.star), t3.argument = this.parseMaybeAssign(e3)), this.finishNode(t3, "YieldExpression");
        }, $.parseAwait = function(e3) {
          this.awaitPos || (this.awaitPos = this.start);
          var t3 = this.startNode();
          return this.next(), t3.argument = this.parseMaybeUnary(null, true, false, e3), this.finishNode(t3, "AwaitExpression");
        };
        var W = acorn_Parser.prototype;
        W.raise = function(e3, t3) {
          var i2 = getLineInfo(this.input, e3);
          t3 += " (" + i2.line + ":" + i2.column + ")", this.sourceFile && (t3 += " in " + this.sourceFile);
          var s2 = new SyntaxError(t3);
          throw s2.pos = e3, s2.loc = i2, s2.raisedAt = this.pos, s2;
        }, W.raiseRecoverable = W.raise, W.curPosition = function() {
          if (this.options.locations) return new acorn_Position(this.curLine, this.pos - this.lineStart);
        };
        var G = acorn_Parser.prototype, acorn_Scope = function(e3) {
          this.flags = e3, this.var = [], this.lexical = [], this.functions = [];
        };
        G.enterScope = function(e3) {
          this.scopeStack.push(new acorn_Scope(e3));
        }, G.exitScope = function() {
          this.scopeStack.pop();
        }, G.treatFunctionsAsVarInScope = function(e3) {
          return 2 & e3.flags || !this.inModule && 1 & e3.flags;
        }, G.declareName = function(e3, t3, i2) {
          var s2 = false;
          if (2 === t3) {
            var r2 = this.currentScope();
            s2 = r2.lexical.indexOf(e3) > -1 || r2.functions.indexOf(e3) > -1 || r2.var.indexOf(e3) > -1, r2.lexical.push(e3), this.inModule && 1 & r2.flags && delete this.undefinedExports[e3];
          } else if (4 === t3) {
            this.currentScope().lexical.push(e3);
          } else if (3 === t3) {
            var n2 = this.currentScope();
            s2 = this.treatFunctionsAsVar ? n2.lexical.indexOf(e3) > -1 : n2.lexical.indexOf(e3) > -1 || n2.var.indexOf(e3) > -1, n2.functions.push(e3);
          } else for (var a2 = this.scopeStack.length - 1; a2 >= 0; --a2) {
            var o2 = this.scopeStack[a2];
            if (o2.lexical.indexOf(e3) > -1 && !(32 & o2.flags && o2.lexical[0] === e3) || !this.treatFunctionsAsVarInScope(o2) && o2.functions.indexOf(e3) > -1) {
              s2 = true;
              break;
            }
            if (o2.var.push(e3), this.inModule && 1 & o2.flags && delete this.undefinedExports[e3], o2.flags & P) break;
          }
          s2 && this.raiseRecoverable(i2, "Identifier '" + e3 + "' has already been declared");
        }, G.checkLocalExport = function(e3) {
          -1 === this.scopeStack[0].lexical.indexOf(e3.name) && -1 === this.scopeStack[0].var.indexOf(e3.name) && (this.undefinedExports[e3.name] = e3);
        }, G.currentScope = function() {
          return this.scopeStack[this.scopeStack.length - 1];
        }, G.currentVarScope = function() {
          for (var e3 = this.scopeStack.length - 1; ; e3--) {
            var t3 = this.scopeStack[e3];
            if (771 & t3.flags) return t3;
          }
        }, G.currentThisScope = function() {
          for (var e3 = this.scopeStack.length - 1; ; e3--) {
            var t3 = this.scopeStack[e3];
            if (771 & t3.flags && !(16 & t3.flags)) return t3;
          }
        };
        var acorn_Node = function(e3, t3, i2) {
          this.type = "", this.start = t3, this.end = 0, e3.options.locations && (this.loc = new acorn_SourceLocation(e3, i2)), e3.options.directSourceFile && (this.sourceFile = e3.options.directSourceFile), e3.options.ranges && (this.range = [t3, 0]);
        }, H = acorn_Parser.prototype;
        function finishNodeAt(e3, t3, i2, s2) {
          return e3.type = t3, e3.end = i2, this.options.locations && (e3.loc.end = s2), this.options.ranges && (e3.range[1] = i2), e3;
        }
        H.startNode = function() {
          return new acorn_Node(this, this.start, this.startLoc);
        }, H.startNodeAt = function(e3, t3) {
          return new acorn_Node(this, e3, t3);
        }, H.finishNode = function(e3, t3) {
          return finishNodeAt.call(this, e3, t3, this.lastTokEnd, this.lastTokEndLoc);
        }, H.finishNodeAt = function(e3, t3, i2, s2) {
          return finishNodeAt.call(this, e3, t3, i2, s2);
        }, H.copyNode = function(e3) {
          var t3 = new acorn_Node(this, e3.start, this.startLoc);
          for (var i2 in e3) t3[i2] = e3[i2];
          return t3;
        };
        var K = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS", z = K + " Extended_Pictographic", J = z + " EBase EComp EMod EPres ExtPict", Y = { 9: K, 10: z, 11: z, 12: J, 13: J, 14: J }, Q = { 9: "", 10: "", 11: "", 12: "", 13: "", 14: "Basic_Emoji Emoji_Keycap_Sequence RGI_Emoji_Modifier_Sequence RGI_Emoji_Flag_Sequence RGI_Emoji_Tag_Sequence RGI_Emoji_ZWJ_Sequence RGI_Emoji" }, Z = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu", X = "Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb", ee = X + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd", te = ee + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho", ie = te + " Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi", se = ie + " Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith", re = { 9: X, 10: ee, 11: te, 12: ie, 13: se, 14: se + " Gara Garay Gukh Gurung_Khema Hrkt Katakana_Or_Hiragana Kawi Kirat_Rai Krai Nag_Mundari Nagm Ol_Onal Onao Sunu Sunuwar Todhri Todr Tulu_Tigalari Tutg Unknown Zzzz" }, ne = {};
        function buildUnicodeData(e3) {
          var t3 = ne[e3] = { binary: wordsRegexp(Y[e3] + " " + Z), binaryOfStrings: wordsRegexp(Q[e3]), nonBinary: { General_Category: wordsRegexp(Z), Script: wordsRegexp(re[e3]) } };
          t3.nonBinary.Script_Extensions = t3.nonBinary.Script, t3.nonBinary.gc = t3.nonBinary.General_Category, t3.nonBinary.sc = t3.nonBinary.Script, t3.nonBinary.scx = t3.nonBinary.Script_Extensions;
        }
        for (var ae = 0, oe = [9, 10, 11, 12, 13, 14]; ae < oe.length; ae += 1) {
          buildUnicodeData(oe[ae]);
        }
        var he = acorn_Parser.prototype, acorn_BranchID = function(e3, t3) {
          this.parent = e3, this.base = t3 || this;
        };
        acorn_BranchID.prototype.separatedFrom = function(e3) {
          for (var t3 = this; t3; t3 = t3.parent) for (var i2 = e3; i2; i2 = i2.parent) if (t3.base === i2.base && t3 !== i2) return true;
          return false;
        }, acorn_BranchID.prototype.sibling = function() {
          return new acorn_BranchID(this.parent, this.base);
        };
        var acorn_RegExpValidationState = function(e3) {
          this.parser = e3, this.validFlags = "gim" + (e3.options.ecmaVersion >= 6 ? "uy" : "") + (e3.options.ecmaVersion >= 9 ? "s" : "") + (e3.options.ecmaVersion >= 13 ? "d" : "") + (e3.options.ecmaVersion >= 15 ? "v" : ""), this.unicodeProperties = ne[e3.options.ecmaVersion >= 14 ? 14 : e3.options.ecmaVersion], this.source = "", this.flags = "", this.start = 0, this.switchU = false, this.switchV = false, this.switchN = false, this.pos = 0, this.lastIntValue = 0, this.lastStringValue = "", this.lastAssertionIsQuantifiable = false, this.numCapturingParens = 0, this.maxBackReference = 0, this.groupNames = /* @__PURE__ */ Object.create(null), this.backReferenceNames = [], this.branchID = null;
        };
        function isRegularExpressionModifier(e3) {
          return 105 === e3 || 109 === e3 || 115 === e3;
        }
        function isSyntaxCharacter(e3) {
          return 36 === e3 || e3 >= 40 && e3 <= 43 || 46 === e3 || 63 === e3 || e3 >= 91 && e3 <= 94 || e3 >= 123 && e3 <= 125;
        }
        function isControlLetter(e3) {
          return e3 >= 65 && e3 <= 90 || e3 >= 97 && e3 <= 122;
        }
        acorn_RegExpValidationState.prototype.reset = function(e3, t3, i2) {
          var s2 = -1 !== i2.indexOf("v"), r2 = -1 !== i2.indexOf("u");
          this.start = 0 | e3, this.source = t3 + "", this.flags = i2, s2 && this.parser.options.ecmaVersion >= 15 ? (this.switchU = true, this.switchV = true, this.switchN = true) : (this.switchU = r2 && this.parser.options.ecmaVersion >= 6, this.switchV = false, this.switchN = r2 && this.parser.options.ecmaVersion >= 9);
        }, acorn_RegExpValidationState.prototype.raise = function(e3) {
          this.parser.raiseRecoverable(this.start, "Invalid regular expression: /" + this.source + "/: " + e3);
        }, acorn_RegExpValidationState.prototype.at = function(e3, t3) {
          void 0 === t3 && (t3 = false);
          var i2 = this.source, s2 = i2.length;
          if (e3 >= s2) return -1;
          var r2 = i2.charCodeAt(e3);
          if (!t3 && !this.switchU || r2 <= 55295 || r2 >= 57344 || e3 + 1 >= s2) return r2;
          var n2 = i2.charCodeAt(e3 + 1);
          return n2 >= 56320 && n2 <= 57343 ? (r2 << 10) + n2 - 56613888 : r2;
        }, acorn_RegExpValidationState.prototype.nextIndex = function(e3, t3) {
          void 0 === t3 && (t3 = false);
          var i2 = this.source, s2 = i2.length;
          if (e3 >= s2) return s2;
          var r2, n2 = i2.charCodeAt(e3);
          return !t3 && !this.switchU || n2 <= 55295 || n2 >= 57344 || e3 + 1 >= s2 || (r2 = i2.charCodeAt(e3 + 1)) < 56320 || r2 > 57343 ? e3 + 1 : e3 + 2;
        }, acorn_RegExpValidationState.prototype.current = function(e3) {
          return void 0 === e3 && (e3 = false), this.at(this.pos, e3);
        }, acorn_RegExpValidationState.prototype.lookahead = function(e3) {
          return void 0 === e3 && (e3 = false), this.at(this.nextIndex(this.pos, e3), e3);
        }, acorn_RegExpValidationState.prototype.advance = function(e3) {
          void 0 === e3 && (e3 = false), this.pos = this.nextIndex(this.pos, e3);
        }, acorn_RegExpValidationState.prototype.eat = function(e3, t3) {
          return void 0 === t3 && (t3 = false), this.current(t3) === e3 && (this.advance(t3), true);
        }, acorn_RegExpValidationState.prototype.eatChars = function(e3, t3) {
          void 0 === t3 && (t3 = false);
          for (var i2 = this.pos, s2 = 0, r2 = e3; s2 < r2.length; s2 += 1) {
            var n2 = r2[s2], a2 = this.at(i2, t3);
            if (-1 === a2 || a2 !== n2) return false;
            i2 = this.nextIndex(i2, t3);
          }
          return this.pos = i2, true;
        }, he.validateRegExpFlags = function(e3) {
          for (var t3 = e3.validFlags, i2 = e3.flags, s2 = false, r2 = false, n2 = 0; n2 < i2.length; n2++) {
            var a2 = i2.charAt(n2);
            -1 === t3.indexOf(a2) && this.raise(e3.start, "Invalid regular expression flag"), i2.indexOf(a2, n2 + 1) > -1 && this.raise(e3.start, "Duplicate regular expression flag"), "u" === a2 && (s2 = true), "v" === a2 && (r2 = true);
          }
          this.options.ecmaVersion >= 15 && s2 && r2 && this.raise(e3.start, "Invalid regular expression flag");
        }, he.validateRegExpPattern = function(e3) {
          this.regexp_pattern(e3), !e3.switchN && this.options.ecmaVersion >= 9 && (function(e4) {
            for (var t3 in e4) return true;
            return false;
          })(e3.groupNames) && (e3.switchN = true, this.regexp_pattern(e3));
        }, he.regexp_pattern = function(e3) {
          e3.pos = 0, e3.lastIntValue = 0, e3.lastStringValue = "", e3.lastAssertionIsQuantifiable = false, e3.numCapturingParens = 0, e3.maxBackReference = 0, e3.groupNames = /* @__PURE__ */ Object.create(null), e3.backReferenceNames.length = 0, e3.branchID = null, this.regexp_disjunction(e3), e3.pos !== e3.source.length && (e3.eat(41) && e3.raise("Unmatched ')'"), (e3.eat(93) || e3.eat(125)) && e3.raise("Lone quantifier brackets")), e3.maxBackReference > e3.numCapturingParens && e3.raise("Invalid escape");
          for (var t3 = 0, i2 = e3.backReferenceNames; t3 < i2.length; t3 += 1) {
            var s2 = i2[t3];
            e3.groupNames[s2] || e3.raise("Invalid named capture referenced");
          }
        }, he.regexp_disjunction = function(e3) {
          var t3 = this.options.ecmaVersion >= 16;
          for (t3 && (e3.branchID = new acorn_BranchID(e3.branchID, null)), this.regexp_alternative(e3); e3.eat(124); ) t3 && (e3.branchID = e3.branchID.sibling()), this.regexp_alternative(e3);
          t3 && (e3.branchID = e3.branchID.parent), this.regexp_eatQuantifier(e3, true) && e3.raise("Nothing to repeat"), e3.eat(123) && e3.raise("Lone quantifier brackets");
        }, he.regexp_alternative = function(e3) {
          for (; e3.pos < e3.source.length && this.regexp_eatTerm(e3); ) ;
        }, he.regexp_eatTerm = function(e3) {
          return this.regexp_eatAssertion(e3) ? (e3.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(e3) && e3.switchU && e3.raise("Invalid quantifier"), true) : !!(e3.switchU ? this.regexp_eatAtom(e3) : this.regexp_eatExtendedAtom(e3)) && (this.regexp_eatQuantifier(e3), true);
        }, he.regexp_eatAssertion = function(e3) {
          var t3 = e3.pos;
          if (e3.lastAssertionIsQuantifiable = false, e3.eat(94) || e3.eat(36)) return true;
          if (e3.eat(92)) {
            if (e3.eat(66) || e3.eat(98)) return true;
            e3.pos = t3;
          }
          if (e3.eat(40) && e3.eat(63)) {
            var i2 = false;
            if (this.options.ecmaVersion >= 9 && (i2 = e3.eat(60)), e3.eat(61) || e3.eat(33)) return this.regexp_disjunction(e3), e3.eat(41) || e3.raise("Unterminated group"), e3.lastAssertionIsQuantifiable = !i2, true;
          }
          return e3.pos = t3, false;
        }, he.regexp_eatQuantifier = function(e3, t3) {
          return void 0 === t3 && (t3 = false), !!this.regexp_eatQuantifierPrefix(e3, t3) && (e3.eat(63), true);
        }, he.regexp_eatQuantifierPrefix = function(e3, t3) {
          return e3.eat(42) || e3.eat(43) || e3.eat(63) || this.regexp_eatBracedQuantifier(e3, t3);
        }, he.regexp_eatBracedQuantifier = function(e3, t3) {
          var i2 = e3.pos;
          if (e3.eat(123)) {
            var s2 = 0, r2 = -1;
            if (this.regexp_eatDecimalDigits(e3) && (s2 = e3.lastIntValue, e3.eat(44) && this.regexp_eatDecimalDigits(e3) && (r2 = e3.lastIntValue), e3.eat(125))) return -1 !== r2 && r2 < s2 && !t3 && e3.raise("numbers out of order in {} quantifier"), true;
            e3.switchU && !t3 && e3.raise("Incomplete quantifier"), e3.pos = i2;
          }
          return false;
        }, he.regexp_eatAtom = function(e3) {
          return this.regexp_eatPatternCharacters(e3) || e3.eat(46) || this.regexp_eatReverseSolidusAtomEscape(e3) || this.regexp_eatCharacterClass(e3) || this.regexp_eatUncapturingGroup(e3) || this.regexp_eatCapturingGroup(e3);
        }, he.regexp_eatReverseSolidusAtomEscape = function(e3) {
          var t3 = e3.pos;
          if (e3.eat(92)) {
            if (this.regexp_eatAtomEscape(e3)) return true;
            e3.pos = t3;
          }
          return false;
        }, he.regexp_eatUncapturingGroup = function(e3) {
          var t3 = e3.pos;
          if (e3.eat(40)) {
            if (e3.eat(63)) {
              if (this.options.ecmaVersion >= 16) {
                var i2 = this.regexp_eatModifiers(e3), s2 = e3.eat(45);
                if (i2 || s2) {
                  for (var r2 = 0; r2 < i2.length; r2++) {
                    var n2 = i2.charAt(r2);
                    i2.indexOf(n2, r2 + 1) > -1 && e3.raise("Duplicate regular expression modifiers");
                  }
                  if (s2) {
                    var a2 = this.regexp_eatModifiers(e3);
                    i2 || a2 || 58 !== e3.current() || e3.raise("Invalid regular expression modifiers");
                    for (var o2 = 0; o2 < a2.length; o2++) {
                      var h2 = a2.charAt(o2);
                      (a2.indexOf(h2, o2 + 1) > -1 || i2.indexOf(h2) > -1) && e3.raise("Duplicate regular expression modifiers");
                    }
                  }
                }
              }
              if (e3.eat(58)) {
                if (this.regexp_disjunction(e3), e3.eat(41)) return true;
                e3.raise("Unterminated group");
              }
            }
            e3.pos = t3;
          }
          return false;
        }, he.regexp_eatCapturingGroup = function(e3) {
          if (e3.eat(40)) {
            if (this.options.ecmaVersion >= 9 ? this.regexp_groupSpecifier(e3) : 63 === e3.current() && e3.raise("Invalid group"), this.regexp_disjunction(e3), e3.eat(41)) return e3.numCapturingParens += 1, true;
            e3.raise("Unterminated group");
          }
          return false;
        }, he.regexp_eatModifiers = function(e3) {
          for (var t3 = "", i2 = 0; -1 !== (i2 = e3.current()) && isRegularExpressionModifier(i2); ) t3 += codePointToString(i2), e3.advance();
          return t3;
        }, he.regexp_eatExtendedAtom = function(e3) {
          return e3.eat(46) || this.regexp_eatReverseSolidusAtomEscape(e3) || this.regexp_eatCharacterClass(e3) || this.regexp_eatUncapturingGroup(e3) || this.regexp_eatCapturingGroup(e3) || this.regexp_eatInvalidBracedQuantifier(e3) || this.regexp_eatExtendedPatternCharacter(e3);
        }, he.regexp_eatInvalidBracedQuantifier = function(e3) {
          return this.regexp_eatBracedQuantifier(e3, true) && e3.raise("Nothing to repeat"), false;
        }, he.regexp_eatSyntaxCharacter = function(e3) {
          var t3 = e3.current();
          return !!isSyntaxCharacter(t3) && (e3.lastIntValue = t3, e3.advance(), true);
        }, he.regexp_eatPatternCharacters = function(e3) {
          for (var t3 = e3.pos, i2 = 0; -1 !== (i2 = e3.current()) && !isSyntaxCharacter(i2); ) e3.advance();
          return e3.pos !== t3;
        }, he.regexp_eatExtendedPatternCharacter = function(e3) {
          var t3 = e3.current();
          return !(-1 === t3 || 36 === t3 || t3 >= 40 && t3 <= 43 || 46 === t3 || 63 === t3 || 91 === t3 || 94 === t3 || 124 === t3) && (e3.advance(), true);
        }, he.regexp_groupSpecifier = function(e3) {
          if (e3.eat(63)) {
            this.regexp_eatGroupName(e3) || e3.raise("Invalid group");
            var t3 = this.options.ecmaVersion >= 16, i2 = e3.groupNames[e3.lastStringValue];
            if (i2) if (t3) for (var s2 = 0, r2 = i2; s2 < r2.length; s2 += 1) {
              r2[s2].separatedFrom(e3.branchID) || e3.raise("Duplicate capture group name");
            }
            else e3.raise("Duplicate capture group name");
            t3 ? (i2 || (e3.groupNames[e3.lastStringValue] = [])).push(e3.branchID) : e3.groupNames[e3.lastStringValue] = true;
          }
        }, he.regexp_eatGroupName = function(e3) {
          if (e3.lastStringValue = "", e3.eat(60)) {
            if (this.regexp_eatRegExpIdentifierName(e3) && e3.eat(62)) return true;
            e3.raise("Invalid capture group name");
          }
          return false;
        }, he.regexp_eatRegExpIdentifierName = function(e3) {
          if (e3.lastStringValue = "", this.regexp_eatRegExpIdentifierStart(e3)) {
            for (e3.lastStringValue += codePointToString(e3.lastIntValue); this.regexp_eatRegExpIdentifierPart(e3); ) e3.lastStringValue += codePointToString(e3.lastIntValue);
            return true;
          }
          return false;
        }, he.regexp_eatRegExpIdentifierStart = function(e3) {
          var t3 = e3.pos, i2 = this.options.ecmaVersion >= 11, s2 = e3.current(i2);
          return e3.advance(i2), 92 === s2 && this.regexp_eatRegExpUnicodeEscapeSequence(e3, i2) && (s2 = e3.lastIntValue), (function(e4) {
            return isIdentifierStart(e4, true) || 36 === e4 || 95 === e4;
          })(s2) ? (e3.lastIntValue = s2, true) : (e3.pos = t3, false);
        }, he.regexp_eatRegExpIdentifierPart = function(e3) {
          var t3 = e3.pos, i2 = this.options.ecmaVersion >= 11, s2 = e3.current(i2);
          return e3.advance(i2), 92 === s2 && this.regexp_eatRegExpUnicodeEscapeSequence(e3, i2) && (s2 = e3.lastIntValue), (function(e4) {
            return isIdentifierChar(e4, true) || 36 === e4 || 95 === e4 || 8204 === e4 || 8205 === e4;
          })(s2) ? (e3.lastIntValue = s2, true) : (e3.pos = t3, false);
        }, he.regexp_eatAtomEscape = function(e3) {
          return !!(this.regexp_eatBackReference(e3) || this.regexp_eatCharacterClassEscape(e3) || this.regexp_eatCharacterEscape(e3) || e3.switchN && this.regexp_eatKGroupName(e3)) || (e3.switchU && (99 === e3.current() && e3.raise("Invalid unicode escape"), e3.raise("Invalid escape")), false);
        }, he.regexp_eatBackReference = function(e3) {
          var t3 = e3.pos;
          if (this.regexp_eatDecimalEscape(e3)) {
            var i2 = e3.lastIntValue;
            if (e3.switchU) return i2 > e3.maxBackReference && (e3.maxBackReference = i2), true;
            if (i2 <= e3.numCapturingParens) return true;
            e3.pos = t3;
          }
          return false;
        }, he.regexp_eatKGroupName = function(e3) {
          if (e3.eat(107)) {
            if (this.regexp_eatGroupName(e3)) return e3.backReferenceNames.push(e3.lastStringValue), true;
            e3.raise("Invalid named reference");
          }
          return false;
        }, he.regexp_eatCharacterEscape = function(e3) {
          return this.regexp_eatControlEscape(e3) || this.regexp_eatCControlLetter(e3) || this.regexp_eatZero(e3) || this.regexp_eatHexEscapeSequence(e3) || this.regexp_eatRegExpUnicodeEscapeSequence(e3, false) || !e3.switchU && this.regexp_eatLegacyOctalEscapeSequence(e3) || this.regexp_eatIdentityEscape(e3);
        }, he.regexp_eatCControlLetter = function(e3) {
          var t3 = e3.pos;
          if (e3.eat(99)) {
            if (this.regexp_eatControlLetter(e3)) return true;
            e3.pos = t3;
          }
          return false;
        }, he.regexp_eatZero = function(e3) {
          return 48 === e3.current() && !isDecimalDigit(e3.lookahead()) && (e3.lastIntValue = 0, e3.advance(), true);
        }, he.regexp_eatControlEscape = function(e3) {
          var t3 = e3.current();
          return 116 === t3 ? (e3.lastIntValue = 9, e3.advance(), true) : 110 === t3 ? (e3.lastIntValue = 10, e3.advance(), true) : 118 === t3 ? (e3.lastIntValue = 11, e3.advance(), true) : 102 === t3 ? (e3.lastIntValue = 12, e3.advance(), true) : 114 === t3 && (e3.lastIntValue = 13, e3.advance(), true);
        }, he.regexp_eatControlLetter = function(e3) {
          var t3 = e3.current();
          return !!isControlLetter(t3) && (e3.lastIntValue = t3 % 32, e3.advance(), true);
        }, he.regexp_eatRegExpUnicodeEscapeSequence = function(e3, t3) {
          void 0 === t3 && (t3 = false);
          var i2, s2 = e3.pos, r2 = t3 || e3.switchU;
          if (e3.eat(117)) {
            if (this.regexp_eatFixedHexDigits(e3, 4)) {
              var n2 = e3.lastIntValue;
              if (r2 && n2 >= 55296 && n2 <= 56319) {
                var a2 = e3.pos;
                if (e3.eat(92) && e3.eat(117) && this.regexp_eatFixedHexDigits(e3, 4)) {
                  var o2 = e3.lastIntValue;
                  if (o2 >= 56320 && o2 <= 57343) return e3.lastIntValue = 1024 * (n2 - 55296) + (o2 - 56320) + 65536, true;
                }
                e3.pos = a2, e3.lastIntValue = n2;
              }
              return true;
            }
            if (r2 && e3.eat(123) && this.regexp_eatHexDigits(e3) && e3.eat(125) && ((i2 = e3.lastIntValue) >= 0 && i2 <= 1114111)) return true;
            r2 && e3.raise("Invalid unicode escape"), e3.pos = s2;
          }
          return false;
        }, he.regexp_eatIdentityEscape = function(e3) {
          if (e3.switchU) return !!this.regexp_eatSyntaxCharacter(e3) || !!e3.eat(47) && (e3.lastIntValue = 47, true);
          var t3 = e3.current();
          return !(99 === t3 || e3.switchN && 107 === t3) && (e3.lastIntValue = t3, e3.advance(), true);
        }, he.regexp_eatDecimalEscape = function(e3) {
          e3.lastIntValue = 0;
          var t3 = e3.current();
          if (t3 >= 49 && t3 <= 57) {
            do {
              e3.lastIntValue = 10 * e3.lastIntValue + (t3 - 48), e3.advance();
            } while ((t3 = e3.current()) >= 48 && t3 <= 57);
            return true;
          }
          return false;
        };
        function isUnicodePropertyNameCharacter(e3) {
          return isControlLetter(e3) || 95 === e3;
        }
        function isUnicodePropertyValueCharacter(e3) {
          return isUnicodePropertyNameCharacter(e3) || isDecimalDigit(e3);
        }
        function isDecimalDigit(e3) {
          return e3 >= 48 && e3 <= 57;
        }
        function isHexDigit(e3) {
          return e3 >= 48 && e3 <= 57 || e3 >= 65 && e3 <= 70 || e3 >= 97 && e3 <= 102;
        }
        function hexToInt(e3) {
          return e3 >= 65 && e3 <= 70 ? e3 - 65 + 10 : e3 >= 97 && e3 <= 102 ? e3 - 97 + 10 : e3 - 48;
        }
        function isOctalDigit(e3) {
          return e3 >= 48 && e3 <= 55;
        }
        he.regexp_eatCharacterClassEscape = function(e3) {
          var t3 = e3.current();
          if (/* @__PURE__ */ (function(e4) {
            return 100 === e4 || 68 === e4 || 115 === e4 || 83 === e4 || 119 === e4 || 87 === e4;
          })(t3)) return e3.lastIntValue = -1, e3.advance(), 1;
          var i2 = false;
          if (e3.switchU && this.options.ecmaVersion >= 9 && ((i2 = 80 === t3) || 112 === t3)) {
            var s2;
            if (e3.lastIntValue = -1, e3.advance(), e3.eat(123) && (s2 = this.regexp_eatUnicodePropertyValueExpression(e3)) && e3.eat(125)) return i2 && 2 === s2 && e3.raise("Invalid property name"), s2;
            e3.raise("Invalid property name");
          }
          return 0;
        }, he.regexp_eatUnicodePropertyValueExpression = function(e3) {
          var t3 = e3.pos;
          if (this.regexp_eatUnicodePropertyName(e3) && e3.eat(61)) {
            var i2 = e3.lastStringValue;
            if (this.regexp_eatUnicodePropertyValue(e3)) {
              var s2 = e3.lastStringValue;
              return this.regexp_validateUnicodePropertyNameAndValue(e3, i2, s2), 1;
            }
          }
          if (e3.pos = t3, this.regexp_eatLoneUnicodePropertyNameOrValue(e3)) {
            var r2 = e3.lastStringValue;
            return this.regexp_validateUnicodePropertyNameOrValue(e3, r2);
          }
          return 0;
        }, he.regexp_validateUnicodePropertyNameAndValue = function(e3, t3, i2) {
          b(e3.unicodeProperties.nonBinary, t3) || e3.raise("Invalid property name"), e3.unicodeProperties.nonBinary[t3].test(i2) || e3.raise("Invalid property value");
        }, he.regexp_validateUnicodePropertyNameOrValue = function(e3, t3) {
          return e3.unicodeProperties.binary.test(t3) ? 1 : e3.switchV && e3.unicodeProperties.binaryOfStrings.test(t3) ? 2 : void e3.raise("Invalid property name");
        }, he.regexp_eatUnicodePropertyName = function(e3) {
          var t3 = 0;
          for (e3.lastStringValue = ""; isUnicodePropertyNameCharacter(t3 = e3.current()); ) e3.lastStringValue += codePointToString(t3), e3.advance();
          return "" !== e3.lastStringValue;
        }, he.regexp_eatUnicodePropertyValue = function(e3) {
          var t3 = 0;
          for (e3.lastStringValue = ""; isUnicodePropertyValueCharacter(t3 = e3.current()); ) e3.lastStringValue += codePointToString(t3), e3.advance();
          return "" !== e3.lastStringValue;
        }, he.regexp_eatLoneUnicodePropertyNameOrValue = function(e3) {
          return this.regexp_eatUnicodePropertyValue(e3);
        }, he.regexp_eatCharacterClass = function(e3) {
          if (e3.eat(91)) {
            var t3 = e3.eat(94), i2 = this.regexp_classContents(e3);
            return e3.eat(93) || e3.raise("Unterminated character class"), t3 && 2 === i2 && e3.raise("Negated character class may contain strings"), true;
          }
          return false;
        }, he.regexp_classContents = function(e3) {
          return 93 === e3.current() ? 1 : e3.switchV ? this.regexp_classSetExpression(e3) : (this.regexp_nonEmptyClassRanges(e3), 1);
        }, he.regexp_nonEmptyClassRanges = function(e3) {
          for (; this.regexp_eatClassAtom(e3); ) {
            var t3 = e3.lastIntValue;
            if (e3.eat(45) && this.regexp_eatClassAtom(e3)) {
              var i2 = e3.lastIntValue;
              !e3.switchU || -1 !== t3 && -1 !== i2 || e3.raise("Invalid character class"), -1 !== t3 && -1 !== i2 && t3 > i2 && e3.raise("Range out of order in character class");
            }
          }
        }, he.regexp_eatClassAtom = function(e3) {
          var t3 = e3.pos;
          if (e3.eat(92)) {
            if (this.regexp_eatClassEscape(e3)) return true;
            if (e3.switchU) {
              var i2 = e3.current();
              (99 === i2 || isOctalDigit(i2)) && e3.raise("Invalid class escape"), e3.raise("Invalid escape");
            }
            e3.pos = t3;
          }
          var s2 = e3.current();
          return 93 !== s2 && (e3.lastIntValue = s2, e3.advance(), true);
        }, he.regexp_eatClassEscape = function(e3) {
          var t3 = e3.pos;
          if (e3.eat(98)) return e3.lastIntValue = 8, true;
          if (e3.switchU && e3.eat(45)) return e3.lastIntValue = 45, true;
          if (!e3.switchU && e3.eat(99)) {
            if (this.regexp_eatClassControlLetter(e3)) return true;
            e3.pos = t3;
          }
          return this.regexp_eatCharacterClassEscape(e3) || this.regexp_eatCharacterEscape(e3);
        }, he.regexp_classSetExpression = function(e3) {
          var t3, i2 = 1;
          if (this.regexp_eatClassSetRange(e3)) ;
          else if (t3 = this.regexp_eatClassSetOperand(e3)) {
            2 === t3 && (i2 = 2);
            for (var s2 = e3.pos; e3.eatChars([38, 38]); ) 38 !== e3.current() && (t3 = this.regexp_eatClassSetOperand(e3)) ? 2 !== t3 && (i2 = 1) : e3.raise("Invalid character in character class");
            if (s2 !== e3.pos) return i2;
            for (; e3.eatChars([45, 45]); ) this.regexp_eatClassSetOperand(e3) || e3.raise("Invalid character in character class");
            if (s2 !== e3.pos) return i2;
          } else e3.raise("Invalid character in character class");
          for (; ; ) if (!this.regexp_eatClassSetRange(e3)) {
            if (!(t3 = this.regexp_eatClassSetOperand(e3))) return i2;
            2 === t3 && (i2 = 2);
          }
        }, he.regexp_eatClassSetRange = function(e3) {
          var t3 = e3.pos;
          if (this.regexp_eatClassSetCharacter(e3)) {
            var i2 = e3.lastIntValue;
            if (e3.eat(45) && this.regexp_eatClassSetCharacter(e3)) {
              var s2 = e3.lastIntValue;
              return -1 !== i2 && -1 !== s2 && i2 > s2 && e3.raise("Range out of order in character class"), true;
            }
            e3.pos = t3;
          }
          return false;
        }, he.regexp_eatClassSetOperand = function(e3) {
          return this.regexp_eatClassSetCharacter(e3) ? 1 : this.regexp_eatClassStringDisjunction(e3) || this.regexp_eatNestedClass(e3);
        }, he.regexp_eatNestedClass = function(e3) {
          var t3 = e3.pos;
          if (e3.eat(91)) {
            var i2 = e3.eat(94), s2 = this.regexp_classContents(e3);
            if (e3.eat(93)) return i2 && 2 === s2 && e3.raise("Negated character class may contain strings"), s2;
            e3.pos = t3;
          }
          if (e3.eat(92)) {
            var r2 = this.regexp_eatCharacterClassEscape(e3);
            if (r2) return r2;
            e3.pos = t3;
          }
          return null;
        }, he.regexp_eatClassStringDisjunction = function(e3) {
          var t3 = e3.pos;
          if (e3.eatChars([92, 113])) {
            if (e3.eat(123)) {
              var i2 = this.regexp_classStringDisjunctionContents(e3);
              if (e3.eat(125)) return i2;
            } else e3.raise("Invalid escape");
            e3.pos = t3;
          }
          return null;
        }, he.regexp_classStringDisjunctionContents = function(e3) {
          for (var t3 = this.regexp_classString(e3); e3.eat(124); ) 2 === this.regexp_classString(e3) && (t3 = 2);
          return t3;
        }, he.regexp_classString = function(e3) {
          for (var t3 = 0; this.regexp_eatClassSetCharacter(e3); ) t3++;
          return 1 === t3 ? 1 : 2;
        }, he.regexp_eatClassSetCharacter = function(e3) {
          var t3 = e3.pos;
          if (e3.eat(92)) return !(!this.regexp_eatCharacterEscape(e3) && !this.regexp_eatClassSetReservedPunctuator(e3)) || (e3.eat(98) ? (e3.lastIntValue = 8, true) : (e3.pos = t3, false));
          var i2 = e3.current();
          return !(i2 < 0 || i2 === e3.lookahead() && (function(e4) {
            return 33 === e4 || e4 >= 35 && e4 <= 38 || e4 >= 42 && e4 <= 44 || 46 === e4 || e4 >= 58 && e4 <= 64 || 94 === e4 || 96 === e4 || 126 === e4;
          })(i2)) && (!(function(e4) {
            return 40 === e4 || 41 === e4 || 45 === e4 || 47 === e4 || e4 >= 91 && e4 <= 93 || e4 >= 123 && e4 <= 125;
          })(i2) && (e3.advance(), e3.lastIntValue = i2, true));
        }, he.regexp_eatClassSetReservedPunctuator = function(e3) {
          var t3 = e3.current();
          return !!(function(e4) {
            return 33 === e4 || 35 === e4 || 37 === e4 || 38 === e4 || 44 === e4 || 45 === e4 || e4 >= 58 && e4 <= 62 || 64 === e4 || 96 === e4 || 126 === e4;
          })(t3) && (e3.lastIntValue = t3, e3.advance(), true);
        }, he.regexp_eatClassControlLetter = function(e3) {
          var t3 = e3.current();
          return !(!isDecimalDigit(t3) && 95 !== t3) && (e3.lastIntValue = t3 % 32, e3.advance(), true);
        }, he.regexp_eatHexEscapeSequence = function(e3) {
          var t3 = e3.pos;
          if (e3.eat(120)) {
            if (this.regexp_eatFixedHexDigits(e3, 2)) return true;
            e3.switchU && e3.raise("Invalid escape"), e3.pos = t3;
          }
          return false;
        }, he.regexp_eatDecimalDigits = function(e3) {
          var t3 = e3.pos, i2 = 0;
          for (e3.lastIntValue = 0; isDecimalDigit(i2 = e3.current()); ) e3.lastIntValue = 10 * e3.lastIntValue + (i2 - 48), e3.advance();
          return e3.pos !== t3;
        }, he.regexp_eatHexDigits = function(e3) {
          var t3 = e3.pos, i2 = 0;
          for (e3.lastIntValue = 0; isHexDigit(i2 = e3.current()); ) e3.lastIntValue = 16 * e3.lastIntValue + hexToInt(i2), e3.advance();
          return e3.pos !== t3;
        }, he.regexp_eatLegacyOctalEscapeSequence = function(e3) {
          if (this.regexp_eatOctalDigit(e3)) {
            var t3 = e3.lastIntValue;
            if (this.regexp_eatOctalDigit(e3)) {
              var i2 = e3.lastIntValue;
              t3 <= 3 && this.regexp_eatOctalDigit(e3) ? e3.lastIntValue = 64 * t3 + 8 * i2 + e3.lastIntValue : e3.lastIntValue = 8 * t3 + i2;
            } else e3.lastIntValue = t3;
            return true;
          }
          return false;
        }, he.regexp_eatOctalDigit = function(e3) {
          var t3 = e3.current();
          return isOctalDigit(t3) ? (e3.lastIntValue = t3 - 48, e3.advance(), true) : (e3.lastIntValue = 0, false);
        }, he.regexp_eatFixedHexDigits = function(e3, t3) {
          var i2 = e3.pos;
          e3.lastIntValue = 0;
          for (var s2 = 0; s2 < t3; ++s2) {
            var r2 = e3.current();
            if (!isHexDigit(r2)) return e3.pos = i2, false;
            e3.lastIntValue = 16 * e3.lastIntValue + hexToInt(r2), e3.advance();
          }
          return true;
        };
        var acorn_Token = function(e3) {
          this.type = e3.type, this.value = e3.value, this.start = e3.start, this.end = e3.end, e3.options.locations && (this.loc = new acorn_SourceLocation(e3, e3.startLoc, e3.endLoc)), e3.options.ranges && (this.range = [e3.start, e3.end]);
        }, ce = acorn_Parser.prototype;
        function stringToBigInt(e3) {
          return "function" != typeof BigInt ? null : BigInt(e3.replace(/_/g, ""));
        }
        ce.next = function(e3) {
          !e3 && this.type.keyword && this.containsEsc && this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword), this.options.onToken && this.options.onToken(new acorn_Token(this)), this.lastTokEnd = this.end, this.lastTokStart = this.start, this.lastTokEndLoc = this.endLoc, this.lastTokStartLoc = this.startLoc, this.nextToken();
        }, ce.getToken = function() {
          return this.next(), new acorn_Token(this);
        }, "undefined" != typeof Symbol && (ce[Symbol.iterator] = function() {
          var e3 = this;
          return { next: function() {
            var t3 = e3.getToken();
            return { done: t3.type === f.eof, value: t3 };
          } };
        }), ce.nextToken = function() {
          var e3 = this.curContext();
          return e3 && e3.preserveSpace || this.skipSpace(), this.start = this.pos, this.options.locations && (this.startLoc = this.curPosition()), this.pos >= this.input.length ? this.finishToken(f.eof) : e3.override ? e3.override(this) : void this.readToken(this.fullCharCodeAtPos());
        }, ce.readToken = function(e3) {
          return isIdentifierStart(e3, this.options.ecmaVersion >= 6) || 92 === e3 ? this.readWord() : this.getTokenFromCode(e3);
        }, ce.fullCharCodeAtPos = function() {
          var e3 = this.input.charCodeAt(this.pos);
          if (e3 <= 55295 || e3 >= 56320) return e3;
          var t3 = this.input.charCodeAt(this.pos + 1);
          return t3 <= 56319 || t3 >= 57344 ? e3 : (e3 << 10) + t3 - 56613888;
        }, ce.skipBlockComment = function() {
          var e3 = this.options.onComment && this.curPosition(), t3 = this.pos, i2 = this.input.indexOf("*/", this.pos += 2);
          if (-1 === i2 && this.raise(this.pos - 2, "Unterminated comment"), this.pos = i2 + 2, this.options.locations) for (var s2 = void 0, r2 = t3; (s2 = nextLineBreak(this.input, r2, this.pos)) > -1; ) ++this.curLine, r2 = this.lineStart = s2;
          this.options.onComment && this.options.onComment(true, this.input.slice(t3 + 2, i2), t3, this.pos, e3, this.curPosition());
        }, ce.skipLineComment = function(e3) {
          for (var t3 = this.pos, i2 = this.options.onComment && this.curPosition(), s2 = this.input.charCodeAt(this.pos += e3); this.pos < this.input.length && !isNewLine(s2); ) s2 = this.input.charCodeAt(++this.pos);
          this.options.onComment && this.options.onComment(false, this.input.slice(t3 + e3, this.pos), t3, this.pos, i2, this.curPosition());
        }, ce.skipSpace = function() {
          e: for (; this.pos < this.input.length; ) {
            var e3 = this.input.charCodeAt(this.pos);
            switch (e3) {
              case 32:
              case 160:
                ++this.pos;
                break;
              case 13:
                10 === this.input.charCodeAt(this.pos + 1) && ++this.pos;
              case 10:
              case 8232:
              case 8233:
                ++this.pos, this.options.locations && (++this.curLine, this.lineStart = this.pos);
                break;
              case 47:
                switch (this.input.charCodeAt(this.pos + 1)) {
                  case 42:
                    this.skipBlockComment();
                    break;
                  case 47:
                    this.skipLineComment(2);
                    break;
                  default:
                    break e;
                }
                break;
              default:
                if (!(e3 > 8 && e3 < 14 || e3 >= 5760 && x.test(String.fromCharCode(e3)))) break e;
                ++this.pos;
            }
          }
        }, ce.finishToken = function(e3, t3) {
          this.end = this.pos, this.options.locations && (this.endLoc = this.curPosition());
          var i2 = this.type;
          this.type = e3, this.value = t3, this.updateContext(i2);
        }, ce.readToken_dot = function() {
          var e3 = this.input.charCodeAt(this.pos + 1);
          if (e3 >= 48 && e3 <= 57) return this.readNumber(true);
          var t3 = this.input.charCodeAt(this.pos + 2);
          return this.options.ecmaVersion >= 6 && 46 === e3 && 46 === t3 ? (this.pos += 3, this.finishToken(f.ellipsis)) : (++this.pos, this.finishToken(f.dot));
        }, ce.readToken_slash = function() {
          var e3 = this.input.charCodeAt(this.pos + 1);
          return this.exprAllowed ? (++this.pos, this.readRegexp()) : 61 === e3 ? this.finishOp(f.assign, 2) : this.finishOp(f.slash, 1);
        }, ce.readToken_mult_modulo_exp = function(e3) {
          var t3 = this.input.charCodeAt(this.pos + 1), i2 = 1, s2 = 42 === e3 ? f.star : f.modulo;
          return this.options.ecmaVersion >= 7 && 42 === e3 && 42 === t3 && (++i2, s2 = f.starstar, t3 = this.input.charCodeAt(this.pos + 2)), 61 === t3 ? this.finishOp(f.assign, i2 + 1) : this.finishOp(s2, i2);
        }, ce.readToken_pipe_amp = function(e3) {
          var t3 = this.input.charCodeAt(this.pos + 1);
          if (t3 === e3) {
            if (this.options.ecmaVersion >= 12) {
              if (61 === this.input.charCodeAt(this.pos + 2)) return this.finishOp(f.assign, 3);
            }
            return this.finishOp(124 === e3 ? f.logicalOR : f.logicalAND, 2);
          }
          return 61 === t3 ? this.finishOp(f.assign, 2) : this.finishOp(124 === e3 ? f.bitwiseOR : f.bitwiseAND, 1);
        }, ce.readToken_caret = function() {
          return 61 === this.input.charCodeAt(this.pos + 1) ? this.finishOp(f.assign, 2) : this.finishOp(f.bitwiseXOR, 1);
        }, ce.readToken_plus_min = function(e3) {
          var t3 = this.input.charCodeAt(this.pos + 1);
          return t3 === e3 ? 45 !== t3 || this.inModule || 62 !== this.input.charCodeAt(this.pos + 2) || 0 !== this.lastTokEnd && !m.test(this.input.slice(this.lastTokEnd, this.pos)) ? this.finishOp(f.incDec, 2) : (this.skipLineComment(3), this.skipSpace(), this.nextToken()) : 61 === t3 ? this.finishOp(f.assign, 2) : this.finishOp(f.plusMin, 1);
        }, ce.readToken_lt_gt = function(e3) {
          var t3 = this.input.charCodeAt(this.pos + 1), i2 = 1;
          return t3 === e3 ? (i2 = 62 === e3 && 62 === this.input.charCodeAt(this.pos + 2) ? 3 : 2, 61 === this.input.charCodeAt(this.pos + i2) ? this.finishOp(f.assign, i2 + 1) : this.finishOp(f.bitShift, i2)) : 33 !== t3 || 60 !== e3 || this.inModule || 45 !== this.input.charCodeAt(this.pos + 2) || 45 !== this.input.charCodeAt(this.pos + 3) ? (61 === t3 && (i2 = 2), this.finishOp(f.relational, i2)) : (this.skipLineComment(4), this.skipSpace(), this.nextToken());
        }, ce.readToken_eq_excl = function(e3) {
          var t3 = this.input.charCodeAt(this.pos + 1);
          return 61 === t3 ? this.finishOp(f.equality, 61 === this.input.charCodeAt(this.pos + 2) ? 3 : 2) : 61 === e3 && 62 === t3 && this.options.ecmaVersion >= 6 ? (this.pos += 2, this.finishToken(f.arrow)) : this.finishOp(61 === e3 ? f.eq : f.prefix, 1);
        }, ce.readToken_question = function() {
          var e3 = this.options.ecmaVersion;
          if (e3 >= 11) {
            var t3 = this.input.charCodeAt(this.pos + 1);
            if (46 === t3) {
              var i2 = this.input.charCodeAt(this.pos + 2);
              if (i2 < 48 || i2 > 57) return this.finishOp(f.questionDot, 2);
            }
            if (63 === t3) {
              if (e3 >= 12) {
                if (61 === this.input.charCodeAt(this.pos + 2)) return this.finishOp(f.assign, 3);
              }
              return this.finishOp(f.coalesce, 2);
            }
          }
          return this.finishOp(f.question, 1);
        }, ce.readToken_numberSign = function() {
          var e3 = 35;
          if (this.options.ecmaVersion >= 13 && (++this.pos, isIdentifierStart(e3 = this.fullCharCodeAtPos(), true) || 92 === e3)) return this.finishToken(f.privateId, this.readWord1());
          this.raise(this.pos, "Unexpected character '" + codePointToString(e3) + "'");
        }, ce.getTokenFromCode = function(e3) {
          switch (e3) {
            case 46:
              return this.readToken_dot();
            case 40:
              return ++this.pos, this.finishToken(f.parenL);
            case 41:
              return ++this.pos, this.finishToken(f.parenR);
            case 59:
              return ++this.pos, this.finishToken(f.semi);
            case 44:
              return ++this.pos, this.finishToken(f.comma);
            case 91:
              return ++this.pos, this.finishToken(f.bracketL);
            case 93:
              return ++this.pos, this.finishToken(f.bracketR);
            case 123:
              return ++this.pos, this.finishToken(f.braceL);
            case 125:
              return ++this.pos, this.finishToken(f.braceR);
            case 58:
              return ++this.pos, this.finishToken(f.colon);
            case 96:
              if (this.options.ecmaVersion < 6) break;
              return ++this.pos, this.finishToken(f.backQuote);
            case 48:
              var t3 = this.input.charCodeAt(this.pos + 1);
              if (120 === t3 || 88 === t3) return this.readRadixNumber(16);
              if (this.options.ecmaVersion >= 6) {
                if (111 === t3 || 79 === t3) return this.readRadixNumber(8);
                if (98 === t3 || 66 === t3) return this.readRadixNumber(2);
              }
            case 49:
            case 50:
            case 51:
            case 52:
            case 53:
            case 54:
            case 55:
            case 56:
            case 57:
              return this.readNumber(false);
            case 34:
            case 39:
              return this.readString(e3);
            case 47:
              return this.readToken_slash();
            case 37:
            case 42:
              return this.readToken_mult_modulo_exp(e3);
            case 124:
            case 38:
              return this.readToken_pipe_amp(e3);
            case 94:
              return this.readToken_caret();
            case 43:
            case 45:
              return this.readToken_plus_min(e3);
            case 60:
            case 62:
              return this.readToken_lt_gt(e3);
            case 61:
            case 33:
              return this.readToken_eq_excl(e3);
            case 63:
              return this.readToken_question();
            case 126:
              return this.finishOp(f.prefix, 1);
            case 35:
              return this.readToken_numberSign();
          }
          this.raise(this.pos, "Unexpected character '" + codePointToString(e3) + "'");
        }, ce.finishOp = function(e3, t3) {
          var i2 = this.input.slice(this.pos, this.pos + t3);
          return this.pos += t3, this.finishToken(e3, i2);
        }, ce.readRegexp = function() {
          for (var e3, t3, i2 = this.pos; ; ) {
            this.pos >= this.input.length && this.raise(i2, "Unterminated regular expression");
            var s2 = this.input.charAt(this.pos);
            if (m.test(s2) && this.raise(i2, "Unterminated regular expression"), e3) e3 = false;
            else {
              if ("[" === s2) t3 = true;
              else if ("]" === s2 && t3) t3 = false;
              else if ("/" === s2 && !t3) break;
              e3 = "\\" === s2;
            }
            ++this.pos;
          }
          var r2 = this.input.slice(i2, this.pos);
          ++this.pos;
          var n2 = this.pos, a2 = this.readWord1();
          this.containsEsc && this.unexpected(n2);
          var o2 = this.regexpState || (this.regexpState = new acorn_RegExpValidationState(this));
          o2.reset(i2, r2, a2), this.validateRegExpFlags(o2), this.validateRegExpPattern(o2);
          var h2 = null;
          try {
            h2 = new RegExp(r2, a2);
          } catch (e4) {
          }
          return this.finishToken(f.regexp, { pattern: r2, flags: a2, value: h2 });
        }, ce.readInt = function(e3, t3, i2) {
          for (var s2 = this.options.ecmaVersion >= 12 && void 0 === t3, r2 = i2 && 48 === this.input.charCodeAt(this.pos), n2 = this.pos, a2 = 0, o2 = 0, h2 = 0, c2 = null == t3 ? 1 / 0 : t3; h2 < c2; ++h2, ++this.pos) {
            var p2 = this.input.charCodeAt(this.pos), l2 = void 0;
            if (s2 && 95 === p2) r2 && this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals"), 95 === o2 && this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore"), 0 === h2 && this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits"), o2 = p2;
            else {
              if ((l2 = p2 >= 97 ? p2 - 97 + 10 : p2 >= 65 ? p2 - 65 + 10 : p2 >= 48 && p2 <= 57 ? p2 - 48 : 1 / 0) >= e3) break;
              o2 = p2, a2 = a2 * e3 + l2;
            }
          }
          return s2 && 95 === o2 && this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits"), this.pos === n2 || null != t3 && this.pos - n2 !== t3 ? null : a2;
        }, ce.readRadixNumber = function(e3) {
          var t3 = this.pos;
          this.pos += 2;
          var i2 = this.readInt(e3);
          return null == i2 && this.raise(this.start + 2, "Expected number in radix " + e3), this.options.ecmaVersion >= 11 && 110 === this.input.charCodeAt(this.pos) ? (i2 = stringToBigInt(this.input.slice(t3, this.pos)), ++this.pos) : isIdentifierStart(this.fullCharCodeAtPos()) && this.raise(this.pos, "Identifier directly after number"), this.finishToken(f.num, i2);
        }, ce.readNumber = function(e3) {
          var t3 = this.pos;
          e3 || null !== this.readInt(10, void 0, true) || this.raise(t3, "Invalid number");
          var i2 = this.pos - t3 >= 2 && 48 === this.input.charCodeAt(t3);
          i2 && this.strict && this.raise(t3, "Invalid number");
          var s2 = this.input.charCodeAt(this.pos);
          if (!i2 && !e3 && this.options.ecmaVersion >= 11 && 110 === s2) {
            var r2 = stringToBigInt(this.input.slice(t3, this.pos));
            return ++this.pos, isIdentifierStart(this.fullCharCodeAtPos()) && this.raise(this.pos, "Identifier directly after number"), this.finishToken(f.num, r2);
          }
          i2 && /[89]/.test(this.input.slice(t3, this.pos)) && (i2 = false), 46 !== s2 || i2 || (++this.pos, this.readInt(10), s2 = this.input.charCodeAt(this.pos)), 69 !== s2 && 101 !== s2 || i2 || (43 !== (s2 = this.input.charCodeAt(++this.pos)) && 45 !== s2 || ++this.pos, null === this.readInt(10) && this.raise(t3, "Invalid number")), isIdentifierStart(this.fullCharCodeAtPos()) && this.raise(this.pos, "Identifier directly after number");
          var n2, a2 = (n2 = this.input.slice(t3, this.pos), i2 ? parseInt(n2, 8) : parseFloat(n2.replace(/_/g, "")));
          return this.finishToken(f.num, a2);
        }, ce.readCodePoint = function() {
          var e3;
          if (123 === this.input.charCodeAt(this.pos)) {
            this.options.ecmaVersion < 6 && this.unexpected();
            var t3 = ++this.pos;
            e3 = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos), ++this.pos, e3 > 1114111 && this.invalidStringToken(t3, "Code point out of bounds");
          } else e3 = this.readHexChar(4);
          return e3;
        }, ce.readString = function(e3) {
          for (var t3 = "", i2 = ++this.pos; ; ) {
            this.pos >= this.input.length && this.raise(this.start, "Unterminated string constant");
            var s2 = this.input.charCodeAt(this.pos);
            if (s2 === e3) break;
            92 === s2 ? (t3 += this.input.slice(i2, this.pos), t3 += this.readEscapedChar(false), i2 = this.pos) : 8232 === s2 || 8233 === s2 ? (this.options.ecmaVersion < 10 && this.raise(this.start, "Unterminated string constant"), ++this.pos, this.options.locations && (this.curLine++, this.lineStart = this.pos)) : (isNewLine(s2) && this.raise(this.start, "Unterminated string constant"), ++this.pos);
          }
          return t3 += this.input.slice(i2, this.pos++), this.finishToken(f.string, t3);
        };
        var pe = {};
        ce.tryReadTemplateToken = function() {
          this.inTemplateElement = true;
          try {
            this.readTmplToken();
          } catch (e3) {
            if (e3 !== pe) throw e3;
            this.readInvalidTemplateToken();
          }
          this.inTemplateElement = false;
        }, ce.invalidStringToken = function(e3, t3) {
          if (this.inTemplateElement && this.options.ecmaVersion >= 9) throw pe;
          this.raise(e3, t3);
        }, ce.readTmplToken = function() {
          for (var e3 = "", t3 = this.pos; ; ) {
            this.pos >= this.input.length && this.raise(this.start, "Unterminated template");
            var i2 = this.input.charCodeAt(this.pos);
            if (96 === i2 || 36 === i2 && 123 === this.input.charCodeAt(this.pos + 1)) return this.pos !== this.start || this.type !== f.template && this.type !== f.invalidTemplate ? (e3 += this.input.slice(t3, this.pos), this.finishToken(f.template, e3)) : 36 === i2 ? (this.pos += 2, this.finishToken(f.dollarBraceL)) : (++this.pos, this.finishToken(f.backQuote));
            if (92 === i2) e3 += this.input.slice(t3, this.pos), e3 += this.readEscapedChar(true), t3 = this.pos;
            else if (isNewLine(i2)) {
              switch (e3 += this.input.slice(t3, this.pos), ++this.pos, i2) {
                case 13:
                  10 === this.input.charCodeAt(this.pos) && ++this.pos;
                case 10:
                  e3 += "\n";
                  break;
                default:
                  e3 += String.fromCharCode(i2);
              }
              this.options.locations && (++this.curLine, this.lineStart = this.pos), t3 = this.pos;
            } else ++this.pos;
          }
        }, ce.readInvalidTemplateToken = function() {
          for (; this.pos < this.input.length; this.pos++) switch (this.input[this.pos]) {
            case "\\":
              ++this.pos;
              break;
            case "$":
              if ("{" !== this.input[this.pos + 1]) break;
            case "`":
              return this.finishToken(f.invalidTemplate, this.input.slice(this.start, this.pos));
            case "\r":
              "\n" === this.input[this.pos + 1] && ++this.pos;
            case "\n":
            case "\u2028":
            case "\u2029":
              ++this.curLine, this.lineStart = this.pos + 1;
          }
          this.raise(this.start, "Unterminated template");
        }, ce.readEscapedChar = function(e3) {
          var t3 = this.input.charCodeAt(++this.pos);
          switch (++this.pos, t3) {
            case 110:
              return "\n";
            case 114:
              return "\r";
            case 120:
              return String.fromCharCode(this.readHexChar(2));
            case 117:
              return codePointToString(this.readCodePoint());
            case 116:
              return "	";
            case 98:
              return "\b";
            case 118:
              return "\v";
            case 102:
              return "\f";
            case 13:
              10 === this.input.charCodeAt(this.pos) && ++this.pos;
            case 10:
              return this.options.locations && (this.lineStart = this.pos, ++this.curLine), "";
            case 56:
            case 57:
              if (this.strict && this.invalidStringToken(this.pos - 1, "Invalid escape sequence"), e3) {
                var i2 = this.pos - 1;
                this.invalidStringToken(i2, "Invalid escape sequence in template string");
              }
            default:
              if (t3 >= 48 && t3 <= 55) {
                var s2 = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0], r2 = parseInt(s2, 8);
                return r2 > 255 && (s2 = s2.slice(0, -1), r2 = parseInt(s2, 8)), this.pos += s2.length - 1, t3 = this.input.charCodeAt(this.pos), "0" === s2 && 56 !== t3 && 57 !== t3 || !this.strict && !e3 || this.invalidStringToken(this.pos - 1 - s2.length, e3 ? "Octal literal in template string" : "Octal literal in strict mode"), String.fromCharCode(r2);
              }
              return isNewLine(t3) ? (this.options.locations && (this.lineStart = this.pos, ++this.curLine), "") : String.fromCharCode(t3);
          }
        }, ce.readHexChar = function(e3) {
          var t3 = this.pos, i2 = this.readInt(16, e3);
          return null === i2 && this.invalidStringToken(t3, "Bad character escape sequence"), i2;
        }, ce.readWord1 = function() {
          this.containsEsc = false;
          for (var e3 = "", t3 = true, i2 = this.pos, s2 = this.options.ecmaVersion >= 6; this.pos < this.input.length; ) {
            var r2 = this.fullCharCodeAtPos();
            if (isIdentifierChar(r2, s2)) this.pos += r2 <= 65535 ? 1 : 2;
            else {
              if (92 !== r2) break;
              this.containsEsc = true, e3 += this.input.slice(i2, this.pos);
              var n2 = this.pos;
              117 !== this.input.charCodeAt(++this.pos) && this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX"), ++this.pos;
              var a2 = this.readCodePoint();
              (t3 ? isIdentifierStart : isIdentifierChar)(a2, s2) || this.invalidStringToken(n2, "Invalid Unicode escape"), e3 += codePointToString(a2), i2 = this.pos;
            }
            t3 = false;
          }
          return e3 + this.input.slice(i2, this.pos);
        }, ce.readWord = function() {
          var e3 = this.readWord1(), t3 = f.name;
          return this.keywords.test(e3) && (t3 = d[e3]), this.finishToken(t3, e3);
        };
        acorn_Parser.acorn = { Parser: acorn_Parser, version: "8.15.0", defaultOptions: I, Position: acorn_Position, SourceLocation: acorn_SourceLocation, getLineInfo, Node: acorn_Node, TokenType: acorn_TokenType, tokTypes: f, keywordTypes: d, TokContext: acorn_TokContext, tokContexts: F, isIdentifierChar, isIdentifierStart, Token: acorn_Token, isNewLine, lineBreak: m, lineBreakG: g, nonASCIIwhitespace: x };
        const le = __require("module"), ue = __require("fs");
        String.fromCharCode;
        const de = /\/$|\/\?|\/#/, fe = /^\.?\//;
        function hasTrailingSlash(e3 = "", t3) {
          return t3 ? de.test(e3) : e3.endsWith("/");
        }
        function withTrailingSlash(e3 = "", t3) {
          if (!t3) return e3.endsWith("/") ? e3 : e3 + "/";
          if (hasTrailingSlash(e3, true)) return e3 || "/";
          let i2 = e3, s2 = "";
          const r2 = e3.indexOf("#");
          if (-1 !== r2 && (i2 = e3.slice(0, r2), s2 = e3.slice(r2), !i2)) return s2;
          const [n2, ...a2] = i2.split("?");
          return n2 + "/" + (a2.length > 0 ? `?${a2.join("?")}` : "") + s2;
        }
        function isNonEmptyURL(e3) {
          return e3 && "/" !== e3;
        }
        function dist_joinURL(e3, ...t3) {
          let i2 = e3 || "";
          for (const e4 of t3.filter((e5) => isNonEmptyURL(e5))) if (i2) {
            const t4 = e4.replace(fe, "");
            i2 = withTrailingSlash(i2) + t4;
          } else i2 = e4;
          return i2;
        }
        /* @__PURE__ */ Symbol.for("ufo:protocolRelative");
        const me = /^[A-Za-z]:\//;
        function pathe_M_eThtNZ_normalizeWindowsPath(e3 = "") {
          return e3 ? e3.replace(/\\/g, "/").replace(me, (e4) => e4.toUpperCase()) : e3;
        }
        const ge = /^[/\\]{2}/, xe = /^[/\\](?![/\\])|^[/\\]{2}(?!\.)|^[A-Za-z]:[/\\]/, ve = /^[A-Za-z]:$/, ye = /.(\.[^./]+|\.)$/, pathe_M_eThtNZ_normalize = function(e3) {
          if (0 === e3.length) return ".";
          const t3 = (e3 = pathe_M_eThtNZ_normalizeWindowsPath(e3)).match(ge), i2 = isAbsolute(e3), s2 = "/" === e3[e3.length - 1];
          return 0 === (e3 = normalizeString(e3, !i2)).length ? i2 ? "/" : s2 ? "./" : "." : (s2 && (e3 += "/"), ve.test(e3) && (e3 += "/"), t3 ? i2 ? `//${e3}` : `//./${e3}` : i2 && !isAbsolute(e3) ? `/${e3}` : e3);
        }, pathe_M_eThtNZ_join = function(...e3) {
          let t3 = "";
          for (const i2 of e3) if (i2) if (t3.length > 0) {
            const e4 = "/" === t3[t3.length - 1], s2 = "/" === i2[0];
            t3 += e4 && s2 ? i2.slice(1) : e4 || s2 ? i2 : `/${i2}`;
          } else t3 += i2;
          return pathe_M_eThtNZ_normalize(t3);
        };
        function pathe_M_eThtNZ_cwd() {
          return "undefined" != typeof process && "function" == typeof process.cwd ? process.cwd().replace(/\\/g, "/") : "/";
        }
        const pathe_M_eThtNZ_resolve = function(...e3) {
          let t3 = "", i2 = false;
          for (let s2 = (e3 = e3.map((e4) => pathe_M_eThtNZ_normalizeWindowsPath(e4))).length - 1; s2 >= -1 && !i2; s2--) {
            const r2 = s2 >= 0 ? e3[s2] : pathe_M_eThtNZ_cwd();
            r2 && 0 !== r2.length && (t3 = `${r2}/${t3}`, i2 = isAbsolute(r2));
          }
          return t3 = normalizeString(t3, !i2), i2 && !isAbsolute(t3) ? `/${t3}` : t3.length > 0 ? t3 : ".";
        };
        function normalizeString(e3, t3) {
          let i2 = "", s2 = 0, r2 = -1, n2 = 0, a2 = null;
          for (let o2 = 0; o2 <= e3.length; ++o2) {
            if (o2 < e3.length) a2 = e3[o2];
            else {
              if ("/" === a2) break;
              a2 = "/";
            }
            if ("/" === a2) {
              if (r2 === o2 - 1 || 1 === n2) ;
              else if (2 === n2) {
                if (i2.length < 2 || 2 !== s2 || "." !== i2[i2.length - 1] || "." !== i2[i2.length - 2]) {
                  if (i2.length > 2) {
                    const e4 = i2.lastIndexOf("/");
                    -1 === e4 ? (i2 = "", s2 = 0) : (i2 = i2.slice(0, e4), s2 = i2.length - 1 - i2.lastIndexOf("/")), r2 = o2, n2 = 0;
                    continue;
                  }
                  if (i2.length > 0) {
                    i2 = "", s2 = 0, r2 = o2, n2 = 0;
                    continue;
                  }
                }
                t3 && (i2 += i2.length > 0 ? "/.." : "..", s2 = 2);
              } else i2.length > 0 ? i2 += `/${e3.slice(r2 + 1, o2)}` : i2 = e3.slice(r2 + 1, o2), s2 = o2 - r2 - 1;
              r2 = o2, n2 = 0;
            } else "." === a2 && -1 !== n2 ? ++n2 : n2 = -1;
          }
          return i2;
        }
        const isAbsolute = function(e3) {
          return xe.test(e3);
        }, extname = function(e3) {
          if (".." === e3) return "";
          const t3 = ye.exec(pathe_M_eThtNZ_normalizeWindowsPath(e3));
          return t3 && t3[1] || "";
        }, pathe_M_eThtNZ_dirname = function(e3) {
          const t3 = pathe_M_eThtNZ_normalizeWindowsPath(e3).replace(/\/$/, "").split("/").slice(0, -1);
          return 1 === t3.length && ve.test(t3[0]) && (t3[0] += "/"), t3.join("/") || (isAbsolute(e3) ? "/" : ".");
        }, basename = function(e3, t3) {
          const i2 = pathe_M_eThtNZ_normalizeWindowsPath(e3).split("/");
          let s2 = "";
          for (let e4 = i2.length - 1; e4 >= 0; e4--) {
            const t4 = i2[e4];
            if (t4) {
              s2 = t4;
              break;
            }
          }
          return t3 && s2.endsWith(t3) ? s2.slice(0, -t3.length) : s2;
        }, _e = __require("url"), Ee = __require("assert"), be = __require("process"), Se = __require("path"), ke = __require("v8"), we = __require("util"), Ie = new Set(le.builtinModules);
        function normalizeSlash(e3) {
          return e3.replace(/\\/g, "/");
        }
        const Ce = {}.hasOwnProperty, Re = /^([A-Z][a-z\d]*)+$/, Pe = /* @__PURE__ */ new Set(["string", "function", "number", "object", "Function", "Object", "boolean", "bigint", "symbol"]), Te = {};
        function formatList(e3, t3 = "and") {
          return e3.length < 3 ? e3.join(` ${t3} `) : `${e3.slice(0, -1).join(", ")}, ${t3} ${e3[e3.length - 1]}`;
        }
        const Ae = /* @__PURE__ */ new Map();
        let Ne;
        function createError(e3, t3, i2) {
          return Ae.set(e3, t3), /* @__PURE__ */ (function(e4, t4) {
            return NodeError;
            function NodeError(...i3) {
              const s2 = Error.stackTraceLimit;
              isErrorStackTraceLimitWritable() && (Error.stackTraceLimit = 0);
              const r2 = new e4();
              isErrorStackTraceLimitWritable() && (Error.stackTraceLimit = s2);
              const n2 = (function(e5, t5, i4) {
                const s3 = Ae.get(e5);
                if (Ee(void 0 !== s3, "expected `message` to be found"), "function" == typeof s3) return Ee(s3.length <= t5.length, `Code: ${e5}; The provided arguments length (${t5.length}) does not match the required ones (${s3.length}).`), Reflect.apply(s3, i4, t5);
                const r3 = /%[dfijoOs]/g;
                let n3 = 0;
                for (; null !== r3.exec(s3); ) n3++;
                return Ee(n3 === t5.length, `Code: ${e5}; The provided arguments length (${t5.length}) does not match the required ones (${n3}).`), 0 === t5.length ? s3 : (t5.unshift(s3), Reflect.apply(we.format, null, t5));
              })(t4, i3, r2);
              return Object.defineProperties(r2, { message: { value: n2, enumerable: false, writable: true, configurable: true }, toString: { value() {
                return `${this.name} [${t4}]: ${this.message}`;
              }, enumerable: false, writable: true, configurable: true } }), Le(r2), r2.code = t4, r2;
            }
          })(i2, e3);
        }
        function isErrorStackTraceLimitWritable() {
          try {
            if (ke.startupSnapshot.isBuildingSnapshot()) return false;
          } catch {
          }
          const e3 = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit");
          return void 0 === e3 ? Object.isExtensible(Error) : Ce.call(e3, "writable") && void 0 !== e3.writable ? e3.writable : void 0 !== e3.set;
        }
        Te.ERR_INVALID_ARG_TYPE = createError("ERR_INVALID_ARG_TYPE", (e3, t3, i2) => {
          Ee("string" == typeof e3, "'name' must be a string"), Array.isArray(t3) || (t3 = [t3]);
          let s2 = "The ";
          if (e3.endsWith(" argument")) s2 += `${e3} `;
          else {
            const t4 = e3.includes(".") ? "property" : "argument";
            s2 += `"${e3}" ${t4} `;
          }
          s2 += "must be ";
          const r2 = [], n2 = [], a2 = [];
          for (const e4 of t3) Ee("string" == typeof e4, "All expected entries have to be of type string"), Pe.has(e4) ? r2.push(e4.toLowerCase()) : null === Re.exec(e4) ? (Ee("object" !== e4, 'The value "object" should be written as "Object"'), a2.push(e4)) : n2.push(e4);
          if (n2.length > 0) {
            const e4 = r2.indexOf("object");
            -1 !== e4 && (r2.slice(e4, 1), n2.push("Object"));
          }
          return r2.length > 0 && (s2 += `${r2.length > 1 ? "one of type" : "of type"} ${formatList(r2, "or")}`, (n2.length > 0 || a2.length > 0) && (s2 += " or ")), n2.length > 0 && (s2 += `an instance of ${formatList(n2, "or")}`, a2.length > 0 && (s2 += " or ")), a2.length > 0 && (a2.length > 1 ? s2 += `one of ${formatList(a2, "or")}` : (a2[0].toLowerCase() !== a2[0] && (s2 += "an "), s2 += `${a2[0]}`)), s2 += `. Received ${(function(e4) {
            if (null == e4) return String(e4);
            if ("function" == typeof e4 && e4.name) return `function ${e4.name}`;
            if ("object" == typeof e4) return e4.constructor && e4.constructor.name ? `an instance of ${e4.constructor.name}` : `${(0, we.inspect)(e4, { depth: -1 })}`;
            let t4 = (0, we.inspect)(e4, { colors: false });
            t4.length > 28 && (t4 = `${t4.slice(0, 25)}...`);
            return `type ${typeof e4} (${t4})`;
          })(i2)}`, s2;
        }, TypeError), Te.ERR_INVALID_MODULE_SPECIFIER = createError("ERR_INVALID_MODULE_SPECIFIER", (e3, t3, i2 = void 0) => `Invalid module "${e3}" ${t3}${i2 ? ` imported from ${i2}` : ""}`, TypeError), Te.ERR_INVALID_PACKAGE_CONFIG = createError("ERR_INVALID_PACKAGE_CONFIG", (e3, t3, i2) => `Invalid package config ${e3}${t3 ? ` while importing ${t3}` : ""}${i2 ? `. ${i2}` : ""}`, Error), Te.ERR_INVALID_PACKAGE_TARGET = createError("ERR_INVALID_PACKAGE_TARGET", (e3, t3, i2, s2 = false, r2 = void 0) => {
          const n2 = "string" == typeof i2 && !s2 && i2.length > 0 && !i2.startsWith("./");
          return "." === t3 ? (Ee(false === s2), `Invalid "exports" main target ${JSON.stringify(i2)} defined in the package config ${e3}package.json${r2 ? ` imported from ${r2}` : ""}${n2 ? '; targets must start with "./"' : ""}`) : `Invalid "${s2 ? "imports" : "exports"}" target ${JSON.stringify(i2)} defined for '${t3}' in the package config ${e3}package.json${r2 ? ` imported from ${r2}` : ""}${n2 ? '; targets must start with "./"' : ""}`;
        }, Error), Te.ERR_MODULE_NOT_FOUND = createError("ERR_MODULE_NOT_FOUND", (e3, t3, i2 = false) => `Cannot find ${i2 ? "module" : "package"} '${e3}' imported from ${t3}`, Error), Te.ERR_NETWORK_IMPORT_DISALLOWED = createError("ERR_NETWORK_IMPORT_DISALLOWED", "import of '%s' by %s is not supported: %s", Error), Te.ERR_PACKAGE_IMPORT_NOT_DEFINED = createError("ERR_PACKAGE_IMPORT_NOT_DEFINED", (e3, t3, i2) => `Package import specifier "${e3}" is not defined${t3 ? ` in package ${t3}package.json` : ""} imported from ${i2}`, TypeError), Te.ERR_PACKAGE_PATH_NOT_EXPORTED = createError("ERR_PACKAGE_PATH_NOT_EXPORTED", (e3, t3, i2 = void 0) => "." === t3 ? `No "exports" main defined in ${e3}package.json${i2 ? ` imported from ${i2}` : ""}` : `Package subpath '${t3}' is not defined by "exports" in ${e3}package.json${i2 ? ` imported from ${i2}` : ""}`, Error), Te.ERR_UNSUPPORTED_DIR_IMPORT = createError("ERR_UNSUPPORTED_DIR_IMPORT", "Directory import '%s' is not supported resolving ES modules imported from %s", Error), Te.ERR_UNSUPPORTED_RESOLVE_REQUEST = createError("ERR_UNSUPPORTED_RESOLVE_REQUEST", 'Failed to resolve module specifier "%s" from "%s": Invalid relative URL or base scheme is not hierarchical.', TypeError), Te.ERR_UNKNOWN_FILE_EXTENSION = createError("ERR_UNKNOWN_FILE_EXTENSION", (e3, t3) => `Unknown file extension "${e3}" for ${t3}`, TypeError), Te.ERR_INVALID_ARG_VALUE = createError("ERR_INVALID_ARG_VALUE", (e3, t3, i2 = "is invalid") => {
          let s2 = (0, we.inspect)(t3);
          s2.length > 128 && (s2 = `${s2.slice(0, 128)}...`);
          return `The ${e3.includes(".") ? "property" : "argument"} '${e3}' ${i2}. Received ${s2}`;
        }, TypeError);
        const Le = (function(e3) {
          const t3 = "__node_internal_" + e3.name;
          return Object.defineProperty(e3, "name", { value: t3 }), e3;
        })(function(e3) {
          const t3 = isErrorStackTraceLimitWritable();
          return t3 && (Ne = Error.stackTraceLimit, Error.stackTraceLimit = Number.POSITIVE_INFINITY), Error.captureStackTrace(e3), t3 && (Error.stackTraceLimit = Ne), e3;
        });
        const Oe = {}.hasOwnProperty, { ERR_INVALID_PACKAGE_CONFIG: De } = Te, Ve = /* @__PURE__ */ new Map();
        function read(e3, { base: t3, specifier: i2 }) {
          const s2 = Ve.get(e3);
          if (s2) return s2;
          let r2;
          try {
            r2 = ue.readFileSync(Se.toNamespacedPath(e3), "utf8");
          } catch (e4) {
            const t4 = e4;
            if ("ENOENT" !== t4.code) throw t4;
          }
          const n2 = { exists: false, pjsonPath: e3, main: void 0, name: void 0, type: "none", exports: void 0, imports: void 0 };
          if (void 0 !== r2) {
            let s3;
            try {
              s3 = JSON.parse(r2);
            } catch (s4) {
              const r3 = s4, n3 = new De(e3, (t3 ? `"${i2}" from ` : "") + (0, _e.fileURLToPath)(t3 || i2), r3.message);
              throw n3.cause = r3, n3;
            }
            n2.exists = true, Oe.call(s3, "name") && "string" == typeof s3.name && (n2.name = s3.name), Oe.call(s3, "main") && "string" == typeof s3.main && (n2.main = s3.main), Oe.call(s3, "exports") && (n2.exports = s3.exports), Oe.call(s3, "imports") && (n2.imports = s3.imports), !Oe.call(s3, "type") || "commonjs" !== s3.type && "module" !== s3.type || (n2.type = s3.type);
          }
          return Ve.set(e3, n2), n2;
        }
        function getPackageScopeConfig(e3) {
          let t3 = new URL("package.json", e3);
          for (; ; ) {
            if (t3.pathname.endsWith("node_modules/package.json")) break;
            const i2 = read((0, _e.fileURLToPath)(t3), { specifier: e3 });
            if (i2.exists) return i2;
            const s2 = t3;
            if (t3 = new URL("../package.json", t3), t3.pathname === s2.pathname) break;
          }
          return { pjsonPath: (0, _e.fileURLToPath)(t3), exists: false, type: "none" };
        }
        function getPackageType(e3) {
          return getPackageScopeConfig(e3).type;
        }
        const { ERR_UNKNOWN_FILE_EXTENSION: Ue } = Te, Me = {}.hasOwnProperty, je = { __proto__: null, ".cjs": "commonjs", ".js": "module", ".json": "json", ".mjs": "module" };
        const Fe = { __proto__: null, "data:": function(e3) {
          const { 1: t3 } = /^([^/]+\/[^;,]+)[^,]*?(;base64)?,/.exec(e3.pathname) || [null, null, null];
          return (function(e4) {
            return e4 && /\s*(text|application)\/javascript\s*(;\s*charset=utf-?8\s*)?/i.test(e4) ? "module" : "application/json" === e4 ? "json" : null;
          })(t3);
        }, "file:": function(e3, t3, i2) {
          const s2 = (function(e4) {
            const t4 = e4.pathname;
            let i3 = t4.length;
            for (; i3--; ) {
              const e5 = t4.codePointAt(i3);
              if (47 === e5) return "";
              if (46 === e5) return 47 === t4.codePointAt(i3 - 1) ? "" : t4.slice(i3);
            }
            return "";
          })(e3);
          if (".js" === s2) {
            const t4 = getPackageType(e3);
            return "none" !== t4 ? t4 : "commonjs";
          }
          if ("" === s2) {
            const t4 = getPackageType(e3);
            return "none" === t4 || "commonjs" === t4 ? "commonjs" : "module";
          }
          const r2 = je[s2];
          if (r2) return r2;
          if (i2) return;
          const n2 = (0, _e.fileURLToPath)(e3);
          throw new Ue(s2, n2);
        }, "http:": getHttpProtocolModuleFormat, "https:": getHttpProtocolModuleFormat, "node:": () => "builtin" };
        function getHttpProtocolModuleFormat() {
        }
        const Be = RegExp.prototype[Symbol.replace], { ERR_INVALID_MODULE_SPECIFIER: $e, ERR_INVALID_PACKAGE_CONFIG: qe, ERR_INVALID_PACKAGE_TARGET: We, ERR_MODULE_NOT_FOUND: Ge, ERR_PACKAGE_IMPORT_NOT_DEFINED: He, ERR_PACKAGE_PATH_NOT_EXPORTED: Ke, ERR_UNSUPPORTED_DIR_IMPORT: ze, ERR_UNSUPPORTED_RESOLVE_REQUEST: Je } = Te, Ye = {}.hasOwnProperty, Qe = /(^|\\|\/)((\.|%2e)(\.|%2e)?|(n|%6e|%4e)(o|%6f|%4f)(d|%64|%44)(e|%65|%45)(_|%5f)(m|%6d|%4d)(o|%6f|%4f)(d|%64|%44)(u|%75|%55)(l|%6c|%4c)(e|%65|%45)(s|%73|%53))?(\\|\/|$)/i, Ze = /(^|\\|\/)((\.|%2e)(\.|%2e)?|(n|%6e|%4e)(o|%6f|%4f)(d|%64|%44)(e|%65|%45)(_|%5f)(m|%6d|%4d)(o|%6f|%4f)(d|%64|%44)(u|%75|%55)(l|%6c|%4c)(e|%65|%45)(s|%73|%53))(\\|\/|$)/i, Xe = /^\.|%|\\/, et = /\*/g, tt = /%2f|%5c/i, it = /* @__PURE__ */ new Set(), st = /[/\\]{2}/;
        function emitInvalidSegmentDeprecation(e3, t3, i2, s2, r2, n2, a2) {
          if (be.noDeprecation) return;
          const o2 = (0, _e.fileURLToPath)(s2), h2 = null !== st.exec(a2 ? e3 : t3);
          be.emitWarning(`Use of deprecated ${h2 ? "double slash" : "leading or trailing slash matching"} resolving "${e3}" for module request "${t3}" ${t3 === i2 ? "" : `matched to "${i2}" `}in the "${r2 ? "imports" : "exports"}" field module resolution of the package at ${o2}${n2 ? ` imported from ${(0, _e.fileURLToPath)(n2)}` : ""}.`, "DeprecationWarning", "DEP0166");
        }
        function emitLegacyIndexDeprecation(e3, t3, i2, s2) {
          if (be.noDeprecation) return;
          const r2 = (function(e4, t4) {
            const i3 = e4.protocol;
            return Me.call(Fe, i3) && Fe[i3](e4, t4, true) || null;
          })(e3, { parentURL: i2.href });
          if ("module" !== r2) return;
          const n2 = (0, _e.fileURLToPath)(e3.href), a2 = (0, _e.fileURLToPath)(new _e.URL(".", t3)), o2 = (0, _e.fileURLToPath)(i2);
          s2 ? Se.resolve(a2, s2) !== n2 && be.emitWarning(`Package ${a2} has a "main" field set to "${s2}", excluding the full filename and extension to the resolved file at "${n2.slice(a2.length)}", imported from ${o2}.
 Automatic extension resolution of the "main" field is deprecated for ES modules.`, "DeprecationWarning", "DEP0151") : be.emitWarning(`No "main" or "exports" field defined in the package.json for ${a2} resolving the main entry point "${n2.slice(a2.length)}", imported from ${o2}.
Default "index" lookups for the main are deprecated for ES modules.`, "DeprecationWarning", "DEP0151");
        }
        function tryStatSync(e3) {
          try {
            return (0, ue.statSync)(e3);
          } catch {
          }
        }
        function fileExists(e3) {
          const t3 = (0, ue.statSync)(e3, { throwIfNoEntry: false }), i2 = t3 ? t3.isFile() : void 0;
          return null != i2 && i2;
        }
        function legacyMainResolve(e3, t3, i2) {
          let s2;
          if (void 0 !== t3.main) {
            if (s2 = new _e.URL(t3.main, e3), fileExists(s2)) return s2;
            const r3 = [`./${t3.main}.js`, `./${t3.main}.json`, `./${t3.main}.node`, `./${t3.main}/index.js`, `./${t3.main}/index.json`, `./${t3.main}/index.node`];
            let n3 = -1;
            for (; ++n3 < r3.length && (s2 = new _e.URL(r3[n3], e3), !fileExists(s2)); ) s2 = void 0;
            if (s2) return emitLegacyIndexDeprecation(s2, e3, i2, t3.main), s2;
          }
          const r2 = ["./index.js", "./index.json", "./index.node"];
          let n2 = -1;
          for (; ++n2 < r2.length && (s2 = new _e.URL(r2[n2], e3), !fileExists(s2)); ) s2 = void 0;
          if (s2) return emitLegacyIndexDeprecation(s2, e3, i2, t3.main), s2;
          throw new Ge((0, _e.fileURLToPath)(new _e.URL(".", e3)), (0, _e.fileURLToPath)(i2));
        }
        function exportsNotFound(e3, t3, i2) {
          return new Ke((0, _e.fileURLToPath)(new _e.URL(".", t3)), e3, i2 && (0, _e.fileURLToPath)(i2));
        }
        function invalidPackageTarget(e3, t3, i2, s2, r2) {
          return t3 = "object" == typeof t3 && null !== t3 ? JSON.stringify(t3, null, "") : `${t3}`, new We((0, _e.fileURLToPath)(new _e.URL(".", i2)), e3, t3, s2, r2 && (0, _e.fileURLToPath)(r2));
        }
        function resolvePackageTargetString(e3, t3, i2, s2, r2, n2, a2, o2, h2) {
          if ("" !== t3 && !n2 && "/" !== e3[e3.length - 1]) throw invalidPackageTarget(i2, e3, s2, a2, r2);
          if (!e3.startsWith("./")) {
            if (a2 && !e3.startsWith("../") && !e3.startsWith("/")) {
              let i3 = false;
              try {
                new _e.URL(e3), i3 = true;
              } catch {
              }
              if (!i3) {
                return packageResolve(n2 ? Be.call(et, e3, () => t3) : e3 + t3, s2, h2);
              }
            }
            throw invalidPackageTarget(i2, e3, s2, a2, r2);
          }
          if (null !== Qe.exec(e3.slice(2))) {
            if (null !== Ze.exec(e3.slice(2))) throw invalidPackageTarget(i2, e3, s2, a2, r2);
            if (!o2) {
              const o3 = n2 ? i2.replace("*", () => t3) : i2 + t3;
              emitInvalidSegmentDeprecation(n2 ? Be.call(et, e3, () => t3) : e3, o3, i2, s2, a2, r2, true);
            }
          }
          const c2 = new _e.URL(e3, s2), p2 = c2.pathname, l2 = new _e.URL(".", s2).pathname;
          if (!p2.startsWith(l2)) throw invalidPackageTarget(i2, e3, s2, a2, r2);
          if ("" === t3) return c2;
          if (null !== Qe.exec(t3)) {
            const h3 = n2 ? i2.replace("*", () => t3) : i2 + t3;
            if (null === Ze.exec(t3)) {
              if (!o2) {
                emitInvalidSegmentDeprecation(n2 ? Be.call(et, e3, () => t3) : e3, h3, i2, s2, a2, r2, false);
              }
            } else !(function(e4, t4, i3, s3, r3) {
              const n3 = `request is not a valid match in pattern "${t4}" for the "${s3 ? "imports" : "exports"}" resolution of ${(0, _e.fileURLToPath)(i3)}`;
              throw new $e(e4, n3, r3 && (0, _e.fileURLToPath)(r3));
            })(h3, i2, s2, a2, r2);
          }
          return n2 ? new _e.URL(Be.call(et, c2.href, () => t3)) : new _e.URL(t3, c2);
        }
        function isArrayIndex(e3) {
          const t3 = Number(e3);
          return `${t3}` === e3 && (t3 >= 0 && t3 < 4294967295);
        }
        function resolvePackageTarget(e3, t3, i2, s2, r2, n2, a2, o2, h2) {
          if ("string" == typeof t3) return resolvePackageTargetString(t3, i2, s2, e3, r2, n2, a2, o2, h2);
          if (Array.isArray(t3)) {
            const c2 = t3;
            if (0 === c2.length) return null;
            let p2, l2 = -1;
            for (; ++l2 < c2.length; ) {
              const t4 = c2[l2];
              let u2;
              try {
                u2 = resolvePackageTarget(e3, t4, i2, s2, r2, n2, a2, o2, h2);
              } catch (e4) {
                if (p2 = e4, "ERR_INVALID_PACKAGE_TARGET" === e4.code) continue;
                throw e4;
              }
              if (void 0 !== u2) {
                if (null !== u2) return u2;
                p2 = null;
              }
            }
            if (null == p2) return null;
            throw p2;
          }
          if ("object" == typeof t3 && null !== t3) {
            const c2 = Object.getOwnPropertyNames(t3);
            let p2 = -1;
            for (; ++p2 < c2.length; ) {
              if (isArrayIndex(c2[p2])) throw new qe((0, _e.fileURLToPath)(e3), r2, '"exports" cannot contain numeric property keys.');
            }
            for (p2 = -1; ++p2 < c2.length; ) {
              const l2 = c2[p2];
              if ("default" === l2 || h2 && h2.has(l2)) {
                const c3 = resolvePackageTarget(e3, t3[l2], i2, s2, r2, n2, a2, o2, h2);
                if (void 0 === c3) continue;
                return c3;
              }
            }
            return null;
          }
          if (null === t3) return null;
          throw invalidPackageTarget(s2, t3, e3, a2, r2);
        }
        function emitTrailingSlashPatternDeprecation(e3, t3, i2) {
          if (be.noDeprecation) return;
          const s2 = (0, _e.fileURLToPath)(t3);
          it.has(s2 + "|" + e3) || (it.add(s2 + "|" + e3), be.emitWarning(`Use of deprecated trailing slash pattern mapping "${e3}" in the "exports" field module resolution of the package at ${s2}${i2 ? ` imported from ${(0, _e.fileURLToPath)(i2)}` : ""}. Mapping specifiers ending in "/" is no longer supported.`, "DeprecationWarning", "DEP0155"));
        }
        function packageExportsResolve(e3, t3, i2, s2, r2) {
          let n2 = i2.exports;
          if ((function(e4, t4, i3) {
            if ("string" == typeof e4 || Array.isArray(e4)) return true;
            if ("object" != typeof e4 || null === e4) return false;
            const s3 = Object.getOwnPropertyNames(e4);
            let r3 = false, n3 = 0, a3 = -1;
            for (; ++a3 < s3.length; ) {
              const e5 = s3[a3], o3 = "" === e5 || "." !== e5[0];
              if (0 === n3++) r3 = o3;
              else if (r3 !== o3) throw new qe((0, _e.fileURLToPath)(t4), i3, `"exports" cannot contain some keys starting with '.' and some not. The exports object must either be an object of package subpath keys or an object of main entry condition name keys only.`);
            }
            return r3;
          })(n2, e3, s2) && (n2 = { ".": n2 }), Ye.call(n2, t3) && !t3.includes("*") && !t3.endsWith("/")) {
            const i3 = resolvePackageTarget(e3, n2[t3], "", t3, s2, false, false, false, r2);
            if (null == i3) throw exportsNotFound(t3, e3, s2);
            return i3;
          }
          let a2 = "", o2 = "";
          const h2 = Object.getOwnPropertyNames(n2);
          let c2 = -1;
          for (; ++c2 < h2.length; ) {
            const i3 = h2[c2], r3 = i3.indexOf("*");
            if (-1 !== r3 && t3.startsWith(i3.slice(0, r3))) {
              t3.endsWith("/") && emitTrailingSlashPatternDeprecation(t3, e3, s2);
              const n3 = i3.slice(r3 + 1);
              t3.length >= i3.length && t3.endsWith(n3) && 1 === patternKeyCompare(a2, i3) && i3.lastIndexOf("*") === r3 && (a2 = i3, o2 = t3.slice(r3, t3.length - n3.length));
            }
          }
          if (a2) {
            const i3 = resolvePackageTarget(e3, n2[a2], o2, a2, s2, true, false, t3.endsWith("/"), r2);
            if (null == i3) throw exportsNotFound(t3, e3, s2);
            return i3;
          }
          throw exportsNotFound(t3, e3, s2);
        }
        function patternKeyCompare(e3, t3) {
          const i2 = e3.indexOf("*"), s2 = t3.indexOf("*"), r2 = -1 === i2 ? e3.length : i2 + 1, n2 = -1 === s2 ? t3.length : s2 + 1;
          return r2 > n2 ? -1 : n2 > r2 || -1 === i2 ? 1 : -1 === s2 || e3.length > t3.length ? -1 : t3.length > e3.length ? 1 : 0;
        }
        function packageImportsResolve(e3, t3, i2) {
          if ("#" === e3 || e3.startsWith("#/") || e3.endsWith("/")) {
            throw new $e(e3, "is not a valid internal imports specifier name", (0, _e.fileURLToPath)(t3));
          }
          let s2;
          const r2 = getPackageScopeConfig(t3);
          if (r2.exists) {
            s2 = (0, _e.pathToFileURL)(r2.pjsonPath);
            const n2 = r2.imports;
            if (n2) if (Ye.call(n2, e3) && !e3.includes("*")) {
              const r3 = resolvePackageTarget(s2, n2[e3], "", e3, t3, false, true, false, i2);
              if (null != r3) return r3;
            } else {
              let r3 = "", a2 = "";
              const o2 = Object.getOwnPropertyNames(n2);
              let h2 = -1;
              for (; ++h2 < o2.length; ) {
                const t4 = o2[h2], i3 = t4.indexOf("*");
                if (-1 !== i3 && e3.startsWith(t4.slice(0, -1))) {
                  const s3 = t4.slice(i3 + 1);
                  e3.length >= t4.length && e3.endsWith(s3) && 1 === patternKeyCompare(r3, t4) && t4.lastIndexOf("*") === i3 && (r3 = t4, a2 = e3.slice(i3, e3.length - s3.length));
                }
              }
              if (r3) {
                const e4 = resolvePackageTarget(s2, n2[r3], a2, r3, t3, true, true, false, i2);
                if (null != e4) return e4;
              }
            }
          }
          throw (function(e4, t4, i3) {
            return new He(e4, t4 && (0, _e.fileURLToPath)(new _e.URL(".", t4)), (0, _e.fileURLToPath)(i3));
          })(e3, s2, t3);
        }
        function packageResolve(e3, t3, i2) {
          if (le.builtinModules.includes(e3)) return new _e.URL("node:" + e3);
          const { packageName: s2, packageSubpath: r2, isScoped: n2 } = (function(e4, t4) {
            let i3 = e4.indexOf("/"), s3 = true, r3 = false;
            "@" === e4[0] && (r3 = true, -1 === i3 || 0 === e4.length ? s3 = false : i3 = e4.indexOf("/", i3 + 1));
            const n3 = -1 === i3 ? e4 : e4.slice(0, i3);
            if (null !== Xe.exec(n3) && (s3 = false), !s3) throw new $e(e4, "is not a valid package name", (0, _e.fileURLToPath)(t4));
            return { packageName: n3, packageSubpath: "." + (-1 === i3 ? "" : e4.slice(i3)), isScoped: r3 };
          })(e3, t3), a2 = getPackageScopeConfig(t3);
          if (a2.exists) {
            const e4 = (0, _e.pathToFileURL)(a2.pjsonPath);
            if (a2.name === s2 && void 0 !== a2.exports && null !== a2.exports) return packageExportsResolve(e4, r2, a2, t3, i2);
          }
          let o2, h2 = new _e.URL("./node_modules/" + s2 + "/package.json", t3), c2 = (0, _e.fileURLToPath)(h2);
          do {
            const a3 = tryStatSync(c2.slice(0, -13));
            if (!a3 || !a3.isDirectory()) {
              o2 = c2, h2 = new _e.URL((n2 ? "../../../../node_modules/" : "../../../node_modules/") + s2 + "/package.json", h2), c2 = (0, _e.fileURLToPath)(h2);
              continue;
            }
            const p2 = read(c2, { base: t3, specifier: e3 });
            return void 0 !== p2.exports && null !== p2.exports ? packageExportsResolve(h2, r2, p2, t3, i2) : "." === r2 ? legacyMainResolve(h2, p2, t3) : new _e.URL(r2, h2);
          } while (c2.length !== o2.length);
          throw new Ge(s2, (0, _e.fileURLToPath)(t3), false);
        }
        function moduleResolve(e3, t3, i2, s2) {
          const r2 = t3.protocol, n2 = "data:" === r2 || "http:" === r2 || "https:" === r2;
          let a2;
          if ((function(e4) {
            return "" !== e4 && ("/" === e4[0] || (function(e5) {
              if ("." === e5[0]) {
                if (1 === e5.length || "/" === e5[1]) return true;
                if ("." === e5[1] && (2 === e5.length || "/" === e5[2])) return true;
              }
              return false;
            })(e4));
          })(e3)) try {
            a2 = new _e.URL(e3, t3);
          } catch (i3) {
            const s3 = new Je(e3, t3);
            throw s3.cause = i3, s3;
          }
          else if ("file:" === r2 && "#" === e3[0]) a2 = packageImportsResolve(e3, t3, i2);
          else try {
            a2 = new _e.URL(e3);
          } catch (s3) {
            if (n2 && !le.builtinModules.includes(e3)) {
              const i3 = new Je(e3, t3);
              throw i3.cause = s3, i3;
            }
            a2 = packageResolve(e3, t3, i2);
          }
          return Ee(void 0 !== a2, "expected to be defined"), "file:" !== a2.protocol ? a2 : (function(e4, t4) {
            if (null !== tt.exec(e4.pathname)) throw new $e(e4.pathname, 'must not include encoded "/" or "\\" characters', (0, _e.fileURLToPath)(t4));
            let i3;
            try {
              i3 = (0, _e.fileURLToPath)(e4);
            } catch (i4) {
              const s4 = i4;
              throw Object.defineProperty(s4, "input", { value: String(e4) }), Object.defineProperty(s4, "module", { value: String(t4) }), s4;
            }
            const s3 = tryStatSync(i3.endsWith("/") ? i3.slice(-1) : i3);
            if (s3 && s3.isDirectory()) {
              const s4 = new ze(i3, (0, _e.fileURLToPath)(t4));
              throw s4.url = String(e4), s4;
            }
            if (!s3 || !s3.isFile()) {
              const s4 = new Ge(i3 || e4.pathname, t4 && (0, _e.fileURLToPath)(t4), true);
              throw s4.url = String(e4), s4;
            }
            {
              const t5 = (0, ue.realpathSync)(i3), { search: s4, hash: r3 } = e4;
              (e4 = (0, _e.pathToFileURL)(t5 + (i3.endsWith(Se.sep) ? "/" : ""))).search = s4, e4.hash = r3;
            }
            return e4;
          })(a2, t3);
        }
        function fileURLToPath(e3) {
          return "string" != typeof e3 || e3.startsWith("file://") ? normalizeSlash((0, _e.fileURLToPath)(e3)) : normalizeSlash(e3);
        }
        function pathToFileURL(e3) {
          return (0, _e.pathToFileURL)(fileURLToPath(e3)).toString();
        }
        const rt = /* @__PURE__ */ new Set(["node", "import"]), nt = [".mjs", ".cjs", ".js", ".json"], at = /* @__PURE__ */ new Set(["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT", "MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED"]);
        function _tryModuleResolve(e3, t3, i2) {
          try {
            return moduleResolve(e3, t3, i2);
          } catch (e4) {
            if (!at.has(e4?.code)) throw e4;
          }
        }
        function _resolve(e3, t3 = {}) {
          if ("string" != typeof e3) {
            if (!(e3 instanceof URL)) throw new TypeError("input must be a `string` or `URL`");
            e3 = fileURLToPath(e3);
          }
          if (/(?:node|data|http|https):/.test(e3)) return e3;
          if (Ie.has(e3)) return "node:" + e3;
          if (e3.startsWith("file://") && (e3 = fileURLToPath(e3)), isAbsolute(e3)) try {
            if ((0, ue.statSync)(e3).isFile()) return pathToFileURL(e3);
          } catch (e4) {
            if ("ENOENT" !== e4?.code) throw e4;
          }
          const i2 = t3.conditions ? new Set(t3.conditions) : rt, s2 = (Array.isArray(t3.url) ? t3.url : [t3.url]).filter(Boolean).map((e4) => new URL((function(e5) {
            return "string" != typeof e5 && (e5 = e5.toString()), /(?:node|data|http|https|file):/.test(e5) ? e5 : Ie.has(e5) ? "node:" + e5 : "file://" + encodeURI(normalizeSlash(e5));
          })(e4.toString())));
          0 === s2.length && s2.push(new URL(pathToFileURL(process.cwd())));
          const r2 = [...s2];
          for (const e4 of s2) "file:" === e4.protocol && r2.push(new URL("./", e4), new URL(dist_joinURL(e4.pathname, "_index.js"), e4), new URL("node_modules", e4));
          let n2;
          for (const s3 of r2) {
            if (n2 = _tryModuleResolve(e3, s3, i2), n2) break;
            for (const r3 of ["", "/index"]) {
              for (const a2 of t3.extensions || nt) if (n2 = _tryModuleResolve(dist_joinURL(e3, r3) + a2, s3, i2), n2) break;
              if (n2) break;
            }
            if (n2) break;
          }
          if (!n2) {
            const t4 = new Error(`Cannot find module ${e3} imported from ${r2.join(", ")}`);
            throw t4.code = "ERR_MODULE_NOT_FOUND", t4;
          }
          return pathToFileURL(n2);
        }
        function resolveSync(e3, t3) {
          return _resolve(e3, t3);
        }
        function resolvePathSync(e3, t3) {
          return fileURLToPath(resolveSync(e3, t3));
        }
        const ot = /(?:[\s;]|^)(?:import[\s\w*,{}]*from|import\s*["'*{]|export\b\s*(?:[*{]|default|class|type|function|const|var|let|async function)|import\.meta\b)/m, ht = /\/\*.+?\*\/|\/\/.*(?=[nr])/g;
        function hasESMSyntax(e3, t3 = {}) {
          return t3.stripComments && (e3 = e3.replace(ht, "")), ot.test(e3);
        }
        function escapeStringRegexp(e3) {
          if ("string" != typeof e3) throw new TypeError("Expected a string");
          return e3.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
        }
        const ct = /* @__PURE__ */ new Set(["/", "\\", void 0]), pt = /* @__PURE__ */ Symbol.for("pathe:normalizedAlias"), lt = /[/\\]/;
        function normalizeAliases(e3) {
          if (e3[pt]) return e3;
          const t3 = Object.fromEntries(Object.entries(e3).sort(([e4], [t4]) => (function(e5, t5) {
            return t5.split("/").length - e5.split("/").length;
          })(e4, t4)));
          for (const e4 in t3) for (const i2 in t3) i2 === e4 || e4.startsWith(i2) || t3[e4]?.startsWith(i2) && ct.has(t3[e4][i2.length]) && (t3[e4] = t3[i2] + t3[e4].slice(i2.length));
          return Object.defineProperty(t3, pt, { value: true, enumerable: false }), t3;
        }
        function utils_hasTrailingSlash(e3 = "/") {
          const t3 = e3[e3.length - 1];
          return "/" === t3 || "\\" === t3;
        }
        var ut = { rE: "2.6.1" };
        const dt = __require("crypto");
        var ft = __webpack_require__.n(dt);
        const mt = /* @__PURE__ */ Object.create(null), dist_i = (e3) => globalThis.process?.env || globalThis.Deno?.env.toObject() || globalThis.__env__ || (e3 ? mt : globalThis), gt = new Proxy(mt, { get: (e3, t3) => dist_i()[t3] ?? mt[t3], has: (e3, t3) => t3 in dist_i() || t3 in mt, set: (e3, t3, i2) => (dist_i(true)[t3] = i2, true), deleteProperty(e3, t3) {
          if (!t3) return false;
          return delete dist_i(true)[t3], true;
        }, ownKeys() {
          const e3 = dist_i(true);
          return Object.keys(e3);
        } }), xt = typeof process < "u" && process.env && process.env.NODE_ENV || "", vt = [["APPVEYOR"], ["AWS_AMPLIFY", "AWS_APP_ID", { ci: true }], ["AZURE_PIPELINES", "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"], ["AZURE_STATIC", "INPUT_AZURE_STATIC_WEB_APPS_API_TOKEN"], ["APPCIRCLE", "AC_APPCIRCLE"], ["BAMBOO", "bamboo_planKey"], ["BITBUCKET", "BITBUCKET_COMMIT"], ["BITRISE", "BITRISE_IO"], ["BUDDY", "BUDDY_WORKSPACE_ID"], ["BUILDKITE"], ["CIRCLE", "CIRCLECI"], ["CIRRUS", "CIRRUS_CI"], ["CLOUDFLARE_PAGES", "CF_PAGES", { ci: true }], ["CLOUDFLARE_WORKERS", "WORKERS_CI", { ci: true }], ["CODEBUILD", "CODEBUILD_BUILD_ARN"], ["CODEFRESH", "CF_BUILD_ID"], ["DRONE"], ["DRONE", "DRONE_BUILD_EVENT"], ["DSARI"], ["GITHUB_ACTIONS"], ["GITLAB", "GITLAB_CI"], ["GITLAB", "CI_MERGE_REQUEST_ID"], ["GOCD", "GO_PIPELINE_LABEL"], ["LAYERCI"], ["HUDSON", "HUDSON_URL"], ["JENKINS", "JENKINS_URL"], ["MAGNUM"], ["NETLIFY"], ["NETLIFY", "NETLIFY_LOCAL", { ci: false }], ["NEVERCODE"], ["RENDER"], ["SAIL", "SAILCI"], ["SEMAPHORE"], ["SCREWDRIVER"], ["SHIPPABLE"], ["SOLANO", "TDDIUM"], ["STRIDER"], ["TEAMCITY", "TEAMCITY_VERSION"], ["TRAVIS"], ["VERCEL", "NOW_BUILDER"], ["VERCEL", "VERCEL", { ci: false }], ["VERCEL", "VERCEL_ENV", { ci: false }], ["APPCENTER", "APPCENTER_BUILD_ID"], ["CODESANDBOX", "CODESANDBOX_SSE", { ci: false }], ["CODESANDBOX", "CODESANDBOX_HOST", { ci: false }], ["STACKBLITZ"], ["STORMKIT"], ["CLEAVR"], ["ZEABUR"], ["CODESPHERE", "CODESPHERE_APP_ID", { ci: true }], ["RAILWAY", "RAILWAY_PROJECT_ID"], ["RAILWAY", "RAILWAY_SERVICE_ID"], ["DENO-DEPLOY", "DENO_DEPLOYMENT_ID"], ["FIREBASE_APP_HOSTING", "FIREBASE_APP_HOSTING", { ci: true }]];
        const yt = (function() {
          if (globalThis.process?.env) for (const e3 of vt) {
            const t3 = e3[1] || e3[0];
            if (globalThis.process?.env[t3]) return { name: e3[0].toLowerCase(), ...e3[2] };
          }
          return "/bin/jsh" === globalThis.process?.env?.SHELL && globalThis.process?.versions?.webcontainer ? { name: "stackblitz", ci: false } : { name: "", ci: false };
        })();
        yt.name;
        function std_env_dist_n(e3) {
          return !!e3 && "false" !== e3;
        }
        const _t = globalThis.process?.platform || "", Et = std_env_dist_n(gt.CI) || false !== yt.ci, bt = std_env_dist_n(globalThis.process?.stdout && globalThis.process?.stdout.isTTY), St = (std_env_dist_n(gt.DEBUG), "test" === xt || std_env_dist_n(gt.TEST)), kt = (std_env_dist_n(gt.MINIMAL), /^win/i.test(_t)), wt = (/^linux/i.test(_t), /^darwin/i.test(_t), !std_env_dist_n(gt.NO_COLOR) && (std_env_dist_n(gt.FORCE_COLOR) || (bt || kt) && gt.TERM), (globalThis.process?.versions?.node || "").replace(/^v/, "") || null), It = (Number(wt?.split(".")[0]), globalThis.process || /* @__PURE__ */ Object.create(null)), Ct = { versions: {} }, Rt = (new Proxy(It, { get: (e3, t3) => "env" === t3 ? gt : t3 in e3 ? e3[t3] : t3 in Ct ? Ct[t3] : void 0 }), "node" === globalThis.process?.release?.name), Pt = !!globalThis.Bun || !!globalThis.process?.versions?.bun, Tt = !!globalThis.Deno, At = !!globalThis.fastly, Nt = [[!!globalThis.Netlify, "netlify"], [!!globalThis.EdgeRuntime, "edge-light"], ["Cloudflare-Workers" === globalThis.navigator?.userAgent, "workerd"], [At, "fastly"], [Tt, "deno"], [Pt, "bun"], [Rt, "node"]];
        !(function() {
          const e3 = Nt.find((e4) => e4[0]);
          if (e3) e3[1];
        })();
        const Lt = __require("tty"), Ot = Lt?.WriteStream?.prototype?.hasColors?.() ?? false, base_format = (e3, t3) => {
          if (!Ot) return (e4) => e4;
          const i2 = `\x1B[${e3}m`, s2 = `\x1B[${t3}m`;
          return (e4) => {
            const r2 = e4 + "";
            let n2 = r2.indexOf(s2);
            if (-1 === n2) return i2 + r2 + s2;
            let a2 = i2, o2 = 0;
            const h2 = (22 === t3 ? s2 : "") + i2;
            for (; -1 !== n2; ) a2 += r2.slice(o2, n2) + h2, o2 = n2 + s2.length, n2 = r2.indexOf(s2, o2);
            return a2 += r2.slice(o2) + s2, a2;
          };
        }, Dt = (base_format(0, 0), base_format(1, 22), base_format(2, 22), base_format(3, 23), base_format(4, 24), base_format(53, 55), base_format(7, 27), base_format(8, 28), base_format(9, 29), base_format(30, 39), base_format(31, 39)), Vt = base_format(32, 39), Ut = base_format(33, 39), Mt = base_format(34, 39), jt = (base_format(35, 39), base_format(36, 39)), Ft = (base_format(37, 39), base_format(90, 39));
        base_format(40, 49), base_format(41, 49), base_format(42, 49), base_format(43, 49), base_format(44, 49), base_format(45, 49), base_format(46, 49), base_format(47, 49), base_format(100, 49), base_format(91, 39), base_format(92, 39), base_format(93, 39), base_format(94, 39), base_format(95, 39), base_format(96, 39), base_format(97, 39), base_format(101, 49), base_format(102, 49), base_format(103, 49), base_format(104, 49), base_format(105, 49), base_format(106, 49), base_format(107, 49);
        function isDir(e3) {
          if ("string" != typeof e3 || e3.startsWith("file://")) return false;
          try {
            return (0, ue.lstatSync)(e3).isDirectory();
          } catch {
            return false;
          }
        }
        function utils_hash(e3, t3 = 8) {
          return ((function() {
            if (void 0 !== $t) return $t;
            try {
              return $t = !!ft().getFips?.(), $t;
            } catch {
              return $t = false, $t;
            }
          })() ? ft().createHash("sha256") : ft().createHash("md5")).update(e3).digest("hex").slice(0, t3);
        }
        const Bt = { true: Vt("true"), false: Ut("false"), "[rebuild]": Ut("[rebuild]"), "[esm]": Mt("[esm]"), "[cjs]": Vt("[cjs]"), "[import]": Mt("[import]"), "[require]": Vt("[require]"), "[native]": jt("[native]"), "[transpile]": Ut("[transpile]"), "[fallback]": Dt("[fallback]"), "[unknown]": Dt("[unknown]"), "[hit]": Vt("[hit]"), "[miss]": Ut("[miss]"), "[json]": Vt("[json]"), "[data]": Vt("[data]") };
        function debug(e3, ...t3) {
          if (!e3.opts.debug) return;
          const i2 = process.cwd();
          console.log(Ft(["[jiti]", ...t3.map((e4) => e4 in Bt ? Bt[e4] : "string" != typeof e4 ? JSON.stringify(e4) : e4.replace(i2, "."))].join(" ")));
        }
        function jitiInteropDefault(e3, t3) {
          return e3.opts.interopDefault ? (function(e4) {
            const t4 = typeof e4;
            if (null === e4 || "object" !== t4 && "function" !== t4) return e4;
            const i2 = e4.default, s2 = typeof i2, r2 = null == i2, n2 = "object" === s2 || "function" === s2;
            if (r2 && e4 instanceof Promise) return e4;
            return new Proxy(e4, { get(t5, s3, a2) {
              if ("__esModule" === s3) return true;
              if ("default" === s3) return r2 ? e4 : "function" == typeof i2?.default && e4.__esModule ? i2.default : i2;
              if (Reflect.has(t5, s3)) return Reflect.get(t5, s3, a2);
              if (n2 && !(i2 instanceof Promise)) {
                let e5 = Reflect.get(i2, s3, a2);
                return "function" == typeof e5 && (e5 = e5.bind(i2)), e5;
              }
            }, apply: (e5, t5, r3) => "function" == typeof e5 ? Reflect.apply(e5, t5, r3) : "function" === s2 ? Reflect.apply(i2, t5, r3) : void 0 });
          })(t3) : t3;
        }
        let $t;
        function _booleanEnv(e3, t3) {
          const i2 = _jsonEnv(e3, t3);
          return Boolean(i2);
        }
        function _jsonEnv(e3, t3) {
          const i2 = process.env[e3];
          if (!(e3 in process.env)) return t3;
          try {
            return JSON.parse(i2);
          } catch {
            return t3;
          }
        }
        const qt = /\.(c|m)?j(sx?)$/, Wt = /\.(c|m)?t(sx?)$/;
        function jitiResolve(e3, t3, i2) {
          let s2, r2;
          if (e3.isNativeRe.test(t3)) return t3;
          e3.alias && (t3 = (function(e4, t4) {
            const i3 = pathe_M_eThtNZ_normalizeWindowsPath(e4);
            t4 = normalizeAliases(t4);
            for (const [e5, s3] of Object.entries(t4)) {
              if (!i3.startsWith(e5)) continue;
              const t5 = utils_hasTrailingSlash(e5) ? e5.slice(0, -1) : e5;
              if (utils_hasTrailingSlash(i3[t5.length])) return pathe_M_eThtNZ_join(s3, i3.slice(e5.length));
            }
            return i3;
          })(t3, e3.alias));
          let n2 = i2?.parentURL || e3.url;
          isDir(n2) && (n2 = pathe_M_eThtNZ_join(n2, "_index.js"));
          const a2 = (i2?.async ? [i2?.conditions, ["node", "import"], ["node", "require"]] : [i2?.conditions, ["node", "require"], ["node", "import"]]).filter(Boolean);
          for (const i3 of a2) {
            try {
              s2 = resolvePathSync(t3, { url: n2, conditions: i3, extensions: e3.opts.extensions });
            } catch (e4) {
              r2 = e4;
            }
            if (s2) return s2;
          }
          try {
            return e3.nativeRequire.resolve(t3, { paths: i2.paths });
          } catch (e4) {
            r2 = e4;
          }
          for (const r3 of e3.additionalExts) {
            if (s2 = tryNativeRequireResolve(e3, t3 + r3, n2, i2) || tryNativeRequireResolve(e3, t3 + "/index" + r3, n2, i2), s2) return s2;
            if ((Wt.test(e3.filename) || Wt.test(e3.parentModule?.filename || "") || qt.test(t3)) && (s2 = tryNativeRequireResolve(e3, t3.replace(qt, ".$1t$2"), n2, i2), s2)) return s2;
          }
          if (!i2?.try) throw r2;
        }
        function tryNativeRequireResolve(e3, t3, i2, s2) {
          try {
            return e3.nativeRequire.resolve(t3, { ...s2, paths: [pathe_M_eThtNZ_dirname(fileURLToPath(i2)), ...s2?.paths || []] });
          } catch {
          }
        }
        const Gt = __require("perf_hooks"), Ht = __require("vm");
        var Kt = __webpack_require__.n(Ht);
        function jitiRequire(e3, t3, i2) {
          const s2 = e3.parentCache || {};
          if (t3.startsWith("node:")) return nativeImportOrRequire(e3, t3, i2.async);
          if (t3.startsWith("file:")) t3 = (0, _e.fileURLToPath)(t3);
          else if (t3.startsWith("data:")) {
            if (!i2.async) throw new Error("`data:` URLs are only supported in ESM context. Use `import` or `jiti.import` instead.");
            return debug(e3, "[native]", "[data]", "[import]", t3), nativeImportOrRequire(e3, t3, true);
          }
          if (le.builtinModules.includes(t3) || ".pnp.js" === t3) return nativeImportOrRequire(e3, t3, i2.async);
          if (e3.opts.tryNative && !e3.opts.transformOptions) try {
            if (!(t3 = jitiResolve(e3, t3, i2)) && i2.try) return;
            if (debug(e3, "[try-native]", i2.async && e3.nativeImport ? "[import]" : "[require]", t3), i2.async && e3.nativeImport) return e3.nativeImport(t3).then((i3) => (false === e3.opts.moduleCache && delete e3.nativeRequire.cache[t3], jitiInteropDefault(e3, i3)));
            {
              const i3 = e3.nativeRequire(t3);
              return false === e3.opts.moduleCache && delete e3.nativeRequire.cache[t3], jitiInteropDefault(e3, i3);
            }
          } catch (i3) {
            debug(e3, `[try-native] Using fallback for ${t3} because of an error:`, i3);
          }
          const r2 = jitiResolve(e3, t3, i2);
          if (!r2 && i2.try) return;
          const n2 = extname(r2);
          if (".json" === n2) {
            debug(e3, "[json]", r2);
            const t4 = e3.nativeRequire(r2);
            return t4 && !("default" in t4) && Object.defineProperty(t4, "default", { value: t4, enumerable: false }), t4;
          }
          if (n2 && !e3.opts.extensions.includes(n2)) return debug(e3, "[native]", "[unknown]", i2.async ? "[import]" : "[require]", r2), nativeImportOrRequire(e3, r2, i2.async);
          if (e3.isNativeRe.test(r2)) return debug(e3, "[native]", i2.async ? "[import]" : "[require]", r2), nativeImportOrRequire(e3, r2, i2.async);
          if (s2[r2]) return jitiInteropDefault(e3, s2[r2]?.exports);
          if (e3.opts.moduleCache) {
            const t4 = e3.nativeRequire.cache[r2];
            if (t4?.loaded) return jitiInteropDefault(e3, t4.exports);
          }
          const a2 = (0, ue.readFileSync)(r2, "utf8");
          return eval_evalModule(e3, a2, { id: t3, filename: r2, ext: n2, cache: s2, async: i2.async });
        }
        function nativeImportOrRequire(e3, t3, i2) {
          return i2 && e3.nativeImport ? e3.nativeImport((function(e4) {
            return kt && isAbsolute(e4) ? pathToFileURL(e4) : e4;
          })(t3)).then((t4) => jitiInteropDefault(e3, t4)) : jitiInteropDefault(e3, e3.nativeRequire(t3));
        }
        const zt = "9";
        function getCache(e3, t3, i2) {
          if (!e3.opts.fsCache || !t3.filename) return i2();
          const s2 = ` /* v${zt}-${utils_hash(t3.source, 16)} */
`;
          let r2 = `${basename(pathe_M_eThtNZ_dirname(t3.filename))}-${(function(e4) {
            const t4 = e4.split(lt).pop();
            if (!t4) return;
            const i3 = t4.lastIndexOf(".");
            return i3 <= 0 ? t4 : t4.slice(0, i3);
          })(t3.filename)}` + (e3.opts.sourceMaps ? "+map" : "") + (t3.interopDefault ? ".i" : "") + `.${utils_hash(t3.filename)}` + (t3.async ? ".mjs" : ".cjs");
          t3.jsx && t3.filename.endsWith("x") && (r2 += "x");
          const n2 = e3.opts.fsCache, a2 = pathe_M_eThtNZ_join(n2, r2);
          if (!e3.opts.rebuildFsCache && (0, ue.existsSync)(a2)) {
            const i3 = (0, ue.readFileSync)(a2, "utf8");
            if (i3.endsWith(s2)) return debug(e3, "[cache]", "[hit]", t3.filename, "~>", a2), i3;
          }
          debug(e3, "[cache]", "[miss]", t3.filename);
          const o2 = i2();
          return o2.includes("__JITI_ERROR__") || ((0, ue.writeFileSync)(a2, o2 + s2, "utf8"), debug(e3, "[cache]", "[store]", t3.filename, "~>", a2)), o2;
        }
        function prepareCacheDir(t3) {
          if (true === t3.opts.fsCache && (t3.opts.fsCache = (function(t4) {
            const i2 = t4.filename && pathe_M_eThtNZ_resolve(t4.filename, "../node_modules");
            if (i2 && (0, ue.existsSync)(i2)) return pathe_M_eThtNZ_join(i2, ".cache/jiti");
            let s2 = (0, e2.tmpdir)();
            if (process.env.TMPDIR && s2 === process.cwd() && !process.env.JITI_RESPECT_TMPDIR_ENV) {
              const t5 = process.env.TMPDIR;
              delete process.env.TMPDIR, s2 = (0, e2.tmpdir)(), process.env.TMPDIR = t5;
            }
            return pathe_M_eThtNZ_join(s2, "jiti");
          })(t3)), t3.opts.fsCache) try {
            if ((0, ue.mkdirSync)(t3.opts.fsCache, { recursive: true }), !(function(e3) {
              try {
                return (0, ue.accessSync)(e3, ue.constants.W_OK), true;
              } catch {
                return false;
              }
            })(t3.opts.fsCache)) throw new Error("directory is not writable!");
          } catch (e3) {
            debug(t3, "Error creating cache directory at ", t3.opts.fsCache, e3), t3.opts.fsCache = false;
          }
        }
        function transform(e3, t3) {
          let i2 = getCache(e3, t3, () => {
            const i3 = e3.opts.transform({ ...e3.opts.transformOptions, babel: { ...e3.opts.sourceMaps ? { sourceFileName: t3.filename, sourceMaps: "inline" } : {}, ...e3.opts.transformOptions?.babel }, interopDefault: e3.opts.interopDefault, ...t3 });
            return i3.error && e3.opts.debug && debug(e3, i3.error), i3.code;
          });
          return i2.startsWith("#!") && (i2 = "// " + i2), i2;
        }
        function eval_evalModule(e3, t3, i2 = {}) {
          const s2 = i2.id || (i2.filename ? basename(i2.filename) : `_jitiEval.${i2.ext || (i2.async ? "mjs" : "js")}`), r2 = i2.filename || jitiResolve(e3, s2, { async: i2.async }), n2 = i2.ext || extname(r2), a2 = i2.cache || e3.parentCache || {}, o2 = /\.[cm]?tsx?$/.test(n2), h2 = ".mjs" === n2 || ".js" === n2 && "module" === (function(e4) {
            for (; e4 && "." !== e4 && "/" !== e4; ) {
              e4 = pathe_M_eThtNZ_join(e4, "..");
              try {
                const t4 = (0, ue.readFileSync)(pathe_M_eThtNZ_join(e4, "package.json"), "utf8");
                try {
                  return JSON.parse(t4);
                } catch {
                }
                break;
              } catch {
              }
            }
          })(r2)?.type, c2 = ".cjs" === n2, p2 = i2.forceTranspile ?? (!c2 && !(h2 && i2.async) && (o2 || h2 || e3.isTransformRe.test(r2) || hasESMSyntax(t3))), l2 = Gt.performance.now();
          if (p2) {
            t3 = transform(e3, { filename: r2, source: t3, ts: o2, async: i2.async ?? false, jsx: e3.opts.jsx });
            const s3 = Math.round(1e3 * (Gt.performance.now() - l2)) / 1e3;
            debug(e3, "[transpile]", i2.async ? "[esm]" : "[cjs]", r2, `(${s3}ms)`);
          } else {
            if (debug(e3, "[native]", i2.async ? "[import]" : "[require]", r2), i2.async) return Promise.resolve(nativeImportOrRequire(e3, r2, i2.async)).catch((s3) => (debug(e3, "Native import error:", s3), debug(e3, "[fallback]", r2), eval_evalModule(e3, t3, { ...i2, forceTranspile: true })));
            try {
              return nativeImportOrRequire(e3, r2, i2.async);
            } catch (s3) {
              debug(e3, "Native require error:", s3), debug(e3, "[fallback]", r2), t3 = transform(e3, { filename: r2, source: t3, ts: o2, async: i2.async ?? false, jsx: e3.opts.jsx });
            }
          }
          const u2 = new le.Module(r2);
          u2.filename = r2, e3.parentModule && (u2.parent = e3.parentModule, Array.isArray(e3.parentModule.children) && !e3.parentModule.children.includes(u2) && e3.parentModule.children.push(u2));
          const d2 = createJiti2(r2, e3.opts, { parentModule: u2, parentCache: a2, nativeImport: e3.nativeImport, onError: e3.onError, createRequire: e3.createRequire }, true);
          let f2;
          u2.require = d2, u2.path = pathe_M_eThtNZ_dirname(r2), u2.paths = le.Module._nodeModulePaths(u2.path), a2[r2] = u2, e3.opts.moduleCache && (e3.nativeRequire.cache[r2] = u2);
          const m2 = (function(e4, t4) {
            return `(${t4?.async ? "async " : ""}function (exports, require, module, __filename, __dirname, jitiImport, jitiESMResolve) { ${e4}
});`;
          })(t3, { async: i2.async });
          try {
            f2 = Kt().runInThisContext(m2, { filename: r2, lineOffset: 0, displayErrors: false });
          } catch (t4) {
            "SyntaxError" === t4.name && i2.async && e3.nativeImport ? (debug(e3, "[esm]", "[import]", "[fallback]", r2), f2 = (function(e4, t5) {
              const i3 = `data:text/javascript;base64,${Buffer.from(`export default ${e4}`).toString("base64")}`;
              return (...e5) => t5(i3).then((t6) => t6.default(...e5));
            })(m2, e3.nativeImport)) : (e3.opts.moduleCache && delete e3.nativeRequire.cache[r2], e3.onError(t4));
          }
          let g2;
          try {
            g2 = f2(u2.exports, u2.require, u2, u2.filename, pathe_M_eThtNZ_dirname(u2.filename), d2.import, d2.esmResolve);
          } catch (t4) {
            e3.opts.moduleCache && delete e3.nativeRequire.cache[r2], e3.onError(t4);
          }
          function next() {
            if (u2.exports && u2.exports.__JITI_ERROR__) {
              const { filename: t4, line: i3, column: s3, code: r3, message: n3 } = u2.exports.__JITI_ERROR__, a3 = new Error(`${r3}: ${n3} 
 ${`${t4}:${i3}:${s3}`}`);
              Error.captureStackTrace(a3, jitiRequire), e3.onError(a3);
            }
            u2.loaded = true;
            return jitiInteropDefault(e3, u2.exports);
          }
          return i2.async ? Promise.resolve(g2).then(next) : next();
        }
        const Jt = "win32" === (0, e2.platform)();
        function createJiti2(e3, t3 = {}, i2, s2 = false) {
          const r2 = s2 ? t3 : (function(e4) {
            const t4 = { fsCache: _booleanEnv("JITI_FS_CACHE", _booleanEnv("JITI_CACHE", true)), rebuildFsCache: _booleanEnv("JITI_REBUILD_FS_CACHE", false), moduleCache: _booleanEnv("JITI_MODULE_CACHE", _booleanEnv("JITI_REQUIRE_CACHE", true)), debug: _booleanEnv("JITI_DEBUG", false), sourceMaps: _booleanEnv("JITI_SOURCE_MAPS", false), interopDefault: _booleanEnv("JITI_INTEROP_DEFAULT", true), extensions: _jsonEnv("JITI_EXTENSIONS", [".js", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".mtsx", ".ctsx"]), alias: _jsonEnv("JITI_ALIAS", {}), nativeModules: _jsonEnv("JITI_NATIVE_MODULES", []), transformModules: _jsonEnv("JITI_TRANSFORM_MODULES", []), tryNative: _jsonEnv("JITI_TRY_NATIVE", "Bun" in globalThis), jsx: _booleanEnv("JITI_JSX", false) };
            t4.jsx && t4.extensions.push(".jsx", ".tsx");
            const i3 = {};
            return void 0 !== e4.cache && (i3.fsCache = e4.cache), void 0 !== e4.requireCache && (i3.moduleCache = e4.requireCache), { ...t4, ...i3, ...e4 };
          })(t3), n2 = r2.alias && Object.keys(r2.alias).length > 0 ? normalizeAliases(r2.alias || {}) : void 0, a2 = ["typescript", "jiti", ...r2.nativeModules || []], o2 = new RegExp(`node_modules/(${a2.map((e4) => escapeStringRegexp(e4)).join("|")})/`), h2 = [...r2.transformModules || []], c2 = new RegExp(`node_modules/(${h2.map((e4) => escapeStringRegexp(e4)).join("|")})/`);
          e3 || (e3 = process.cwd()), !s2 && isDir(e3) && (e3 = pathe_M_eThtNZ_join(e3, "_index.js"));
          const p2 = pathToFileURL(e3), l2 = [...r2.extensions].filter((e4) => ".js" !== e4), u2 = i2.createRequire(Jt ? e3.replace(/\//g, "\\") : e3), d2 = { filename: e3, url: p2, opts: r2, alias: n2, nativeModules: a2, transformModules: h2, isNativeRe: o2, isTransformRe: c2, additionalExts: l2, nativeRequire: u2, onError: i2.onError, parentModule: i2.parentModule, parentCache: i2.parentCache, nativeImport: i2.nativeImport, createRequire: i2.createRequire };
          s2 || debug(d2, "[init]", ...[["version:", ut.rE], ["module-cache:", r2.moduleCache], ["fs-cache:", r2.fsCache], ["rebuild-fs-cache:", r2.rebuildFsCache], ["interop-defaults:", r2.interopDefault]].flat()), s2 || prepareCacheDir(d2);
          const f2 = Object.assign(function(e4) {
            return jitiRequire(d2, e4, { async: false });
          }, { cache: r2.moduleCache ? u2.cache : /* @__PURE__ */ Object.create(null), extensions: u2.extensions, main: u2.main, options: r2, resolve: Object.assign(function(e4) {
            return jitiResolve(d2, e4, { async: false });
          }, { paths: u2.resolve.paths }), transform: (e4) => transform(d2, e4), evalModule: (e4, t4) => eval_evalModule(d2, e4, t4), async import(e4, t4) {
            const i3 = await jitiRequire(d2, e4, { ...t4, async: true });
            return t4?.default ? i3?.default ?? i3 : i3;
          }, esmResolve(e4, t4) {
            "string" == typeof t4 && (t4 = { parentURL: t4 });
            const i3 = jitiResolve(d2, e4, { parentURL: p2, ...t4, async: true });
            return !i3 || "string" != typeof i3 || i3.startsWith("file://") ? i3 : pathToFileURL(i3);
          } });
          return f2;
        }
      })(), module.exports = i.default;
    })();
  }
});

// node_modules/jiti/lib/jiti.mjs
var import_jiti = __toESM(require_jiti(), 1);
import { createRequire } from "module";
function onError(err) {
  throw err;
}
var nativeImport = (id) => import(id);
var _transform;
function lazyTransform(...args) {
  if (!_transform) {
    _transform = createRequire(import.meta.url)("../dist/babel.cjs");
  }
  return _transform(...args);
}
function createJiti(id, opts = {}) {
  if (!opts.transform) {
    opts = { ...opts, transform: lazyTransform };
  }
  return (0, import_jiti.default)(id, opts, {
    onError,
    nativeImport,
    createRequire
  });
}
var jiti_default = createJiti;
export {
  createJiti,
  jiti_default as default
};
