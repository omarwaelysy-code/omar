import {
  __commonJS,
  __require,
  __toESM
} from "./chunk-2EL6F67R.js";

// node_modules/esbuild/lib/main.js
var require_main = __commonJS({
  "node_modules/esbuild/lib/main.js"(exports, module2) {
    "use strict";
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    var node_exports = {};
    __export(node_exports, {
      analyzeMetafile: () => analyzeMetafile,
      analyzeMetafileSync: () => analyzeMetafileSync,
      build: () => build,
      buildSync: () => buildSync,
      context: () => context,
      default: () => node_default,
      formatMessages: () => formatMessages,
      formatMessagesSync: () => formatMessagesSync,
      initialize: () => initialize,
      stop: () => stop,
      transform: () => transform,
      transformSync: () => transformSync,
      version: () => version
    });
    module2.exports = __toCommonJS(node_exports);
    function encodePacket(packet) {
      let visit = (value) => {
        if (value === null) {
          bb.write8(0);
        } else if (typeof value === "boolean") {
          bb.write8(1);
          bb.write8(+value);
        } else if (typeof value === "number") {
          bb.write8(2);
          bb.write32(value | 0);
        } else if (typeof value === "string") {
          bb.write8(3);
          bb.write(encodeUTF8(value));
        } else if (value instanceof Uint8Array) {
          bb.write8(4);
          bb.write(value);
        } else if (value instanceof Array) {
          bb.write8(5);
          bb.write32(value.length);
          for (let item of value) {
            visit(item);
          }
        } else {
          let keys = Object.keys(value);
          bb.write8(6);
          bb.write32(keys.length);
          for (let key of keys) {
            bb.write(encodeUTF8(key));
            visit(value[key]);
          }
        }
      };
      let bb = new ByteBuffer();
      bb.write32(0);
      bb.write32(packet.id << 1 | +!packet.isRequest);
      visit(packet.value);
      writeUInt32LE(bb.buf, bb.len - 4, 0);
      return bb.buf.subarray(0, bb.len);
    }
    function decodePacket(bytes) {
      let visit = () => {
        switch (bb.read8()) {
          case 0:
            return null;
          case 1:
            return !!bb.read8();
          case 2:
            return bb.read32();
          case 3:
            return decodeUTF8(bb.read());
          case 4:
            return bb.read();
          case 5: {
            let count = bb.read32();
            let value2 = [];
            for (let i5 = 0; i5 < count; i5++) {
              value2.push(visit());
            }
            return value2;
          }
          case 6: {
            let count = bb.read32();
            let value2 = {};
            for (let i5 = 0; i5 < count; i5++) {
              value2[decodeUTF8(bb.read())] = visit();
            }
            return value2;
          }
          default:
            throw new Error("Invalid packet");
        }
      };
      let bb = new ByteBuffer(bytes);
      let id = bb.read32();
      let isRequest = (id & 1) === 0;
      id >>>= 1;
      let value = visit();
      if (bb.ptr !== bytes.length) {
        throw new Error("Invalid packet");
      }
      return { id, isRequest, value };
    }
    var ByteBuffer = class {
      constructor(buf = new Uint8Array(1024)) {
        this.buf = buf;
        this.len = 0;
        this.ptr = 0;
      }
      _write(delta) {
        if (this.len + delta > this.buf.length) {
          let clone = new Uint8Array((this.len + delta) * 2);
          clone.set(this.buf);
          this.buf = clone;
        }
        this.len += delta;
        return this.len - delta;
      }
      write8(value) {
        let offset = this._write(1);
        this.buf[offset] = value;
      }
      write32(value) {
        let offset = this._write(4);
        writeUInt32LE(this.buf, value, offset);
      }
      write(bytes) {
        let offset = this._write(4 + bytes.length);
        writeUInt32LE(this.buf, bytes.length, offset);
        this.buf.set(bytes, offset + 4);
      }
      _read(delta) {
        if (this.ptr + delta > this.buf.length) {
          throw new Error("Invalid packet");
        }
        this.ptr += delta;
        return this.ptr - delta;
      }
      read8() {
        return this.buf[this._read(1)];
      }
      read32() {
        return readUInt32LE(this.buf, this._read(4));
      }
      read() {
        let length = this.read32();
        let bytes = new Uint8Array(length);
        let ptr = this._read(bytes.length);
        bytes.set(this.buf.subarray(ptr, ptr + length));
        return bytes;
      }
    };
    var encodeUTF8;
    var decodeUTF8;
    var encodeInvariant;
    if (typeof TextEncoder !== "undefined" && typeof TextDecoder !== "undefined") {
      let encoder = new TextEncoder();
      let decoder = new TextDecoder();
      encodeUTF8 = (text) => encoder.encode(text);
      decodeUTF8 = (bytes) => decoder.decode(bytes);
      encodeInvariant = 'new TextEncoder().encode("")';
    } else if (typeof Buffer !== "undefined") {
      encodeUTF8 = (text) => Buffer.from(text);
      decodeUTF8 = (bytes) => {
        let { buffer, byteOffset, byteLength } = bytes;
        return Buffer.from(buffer, byteOffset, byteLength).toString();
      };
      encodeInvariant = 'Buffer.from("")';
    } else {
      throw new Error("No UTF-8 codec found");
    }
    if (!(encodeUTF8("") instanceof Uint8Array))
      throw new Error(`Invariant violation: "${encodeInvariant} instanceof Uint8Array" is incorrectly false

This indicates that your JavaScript environment is broken. You cannot use
esbuild in this environment because esbuild relies on this invariant. This
is not a problem with esbuild. You need to fix your environment instead.
`);
    function readUInt32LE(buffer, offset) {
      return (buffer[offset++] | buffer[offset++] << 8 | buffer[offset++] << 16 | buffer[offset++] << 24) >>> 0;
    }
    function writeUInt32LE(buffer, value, offset) {
      buffer[offset++] = value;
      buffer[offset++] = value >> 8;
      buffer[offset++] = value >> 16;
      buffer[offset++] = value >> 24;
    }
    var fromCharCode = String.fromCharCode;
    function throwSyntaxError(bytes, index, message) {
      const c2 = bytes[index];
      let line = 1;
      let column = 0;
      for (let i5 = 0; i5 < index; i5++) {
        if (bytes[i5] === 10) {
          line++;
          column = 0;
        } else {
          column++;
        }
      }
      throw new SyntaxError(
        message ? message : index === bytes.length ? "Unexpected end of input while parsing JSON" : c2 >= 32 && c2 <= 126 ? `Unexpected character ${fromCharCode(c2)} in JSON at position ${index} (line ${line}, column ${column})` : `Unexpected byte 0x${c2.toString(16)} in JSON at position ${index} (line ${line}, column ${column})`
      );
    }
    function JSON_parse(bytes) {
      if (!(bytes instanceof Uint8Array)) {
        throw new Error(`JSON input must be a Uint8Array`);
      }
      const propertyStack = [];
      const objectStack = [];
      const stateStack = [];
      const length = bytes.length;
      let property = null;
      let state = 0;
      let object;
      let i5 = 0;
      while (i5 < length) {
        let c2 = bytes[i5++];
        if (c2 <= 32) {
          continue;
        }
        let value;
        if (state === 2 && property === null && c2 !== 34 && c2 !== 125) {
          throwSyntaxError(bytes, --i5);
        }
        switch (c2) {
          // True
          case 116: {
            if (bytes[i5++] !== 114 || bytes[i5++] !== 117 || bytes[i5++] !== 101) {
              throwSyntaxError(bytes, --i5);
            }
            value = true;
            break;
          }
          // False
          case 102: {
            if (bytes[i5++] !== 97 || bytes[i5++] !== 108 || bytes[i5++] !== 115 || bytes[i5++] !== 101) {
              throwSyntaxError(bytes, --i5);
            }
            value = false;
            break;
          }
          // Null
          case 110: {
            if (bytes[i5++] !== 117 || bytes[i5++] !== 108 || bytes[i5++] !== 108) {
              throwSyntaxError(bytes, --i5);
            }
            value = null;
            break;
          }
          // Number begin
          case 45:
          case 46:
          case 48:
          case 49:
          case 50:
          case 51:
          case 52:
          case 53:
          case 54:
          case 55:
          case 56:
          case 57: {
            let index = i5;
            value = fromCharCode(c2);
            c2 = bytes[i5];
            while (true) {
              switch (c2) {
                case 43:
                case 45:
                case 46:
                case 48:
                case 49:
                case 50:
                case 51:
                case 52:
                case 53:
                case 54:
                case 55:
                case 56:
                case 57:
                case 101:
                case 69: {
                  value += fromCharCode(c2);
                  c2 = bytes[++i5];
                  continue;
                }
              }
              break;
            }
            value = +value;
            if (isNaN(value)) {
              throwSyntaxError(bytes, --index, "Invalid number");
            }
            break;
          }
          // String begin
          case 34: {
            value = "";
            while (true) {
              if (i5 >= length) {
                throwSyntaxError(bytes, length);
              }
              c2 = bytes[i5++];
              if (c2 === 34) {
                break;
              } else if (c2 === 92) {
                switch (bytes[i5++]) {
                  // Normal escape sequence
                  case 34:
                    value += '"';
                    break;
                  case 47:
                    value += "/";
                    break;
                  case 92:
                    value += "\\";
                    break;
                  case 98:
                    value += "\b";
                    break;
                  case 102:
                    value += "\f";
                    break;
                  case 110:
                    value += "\n";
                    break;
                  case 114:
                    value += "\r";
                    break;
                  case 116:
                    value += "	";
                    break;
                  // Unicode escape sequence
                  case 117: {
                    let code = 0;
                    for (let j2 = 0; j2 < 4; j2++) {
                      c2 = bytes[i5++];
                      code <<= 4;
                      if (c2 >= 48 && c2 <= 57) code |= c2 - 48;
                      else if (c2 >= 97 && c2 <= 102) code |= c2 + (10 - 97);
                      else if (c2 >= 65 && c2 <= 70) code |= c2 + (10 - 65);
                      else throwSyntaxError(bytes, --i5);
                    }
                    value += fromCharCode(code);
                    break;
                  }
                  // Invalid escape sequence
                  default:
                    throwSyntaxError(bytes, --i5);
                    break;
                }
              } else if (c2 <= 127) {
                value += fromCharCode(c2);
              } else if ((c2 & 224) === 192) {
                value += fromCharCode((c2 & 31) << 6 | bytes[i5++] & 63);
              } else if ((c2 & 240) === 224) {
                value += fromCharCode((c2 & 15) << 12 | (bytes[i5++] & 63) << 6 | bytes[i5++] & 63);
              } else if ((c2 & 248) == 240) {
                let codePoint = (c2 & 7) << 18 | (bytes[i5++] & 63) << 12 | (bytes[i5++] & 63) << 6 | bytes[i5++] & 63;
                if (codePoint > 65535) {
                  codePoint -= 65536;
                  value += fromCharCode(codePoint >> 10 & 1023 | 55296);
                  codePoint = 56320 | codePoint & 1023;
                }
                value += fromCharCode(codePoint);
              }
            }
            value[0];
            break;
          }
          // Array begin
          case 91: {
            value = [];
            propertyStack.push(property);
            objectStack.push(object);
            stateStack.push(state);
            property = null;
            object = value;
            state = 1;
            continue;
          }
          // Object begin
          case 123: {
            value = {};
            propertyStack.push(property);
            objectStack.push(object);
            stateStack.push(state);
            property = null;
            object = value;
            state = 2;
            continue;
          }
          // Array end
          case 93: {
            if (state !== 1) {
              throwSyntaxError(bytes, --i5);
            }
            value = object;
            property = propertyStack.pop();
            object = objectStack.pop();
            state = stateStack.pop();
            break;
          }
          // Object end
          case 125: {
            if (state !== 2) {
              throwSyntaxError(bytes, --i5);
            }
            value = object;
            property = propertyStack.pop();
            object = objectStack.pop();
            state = stateStack.pop();
            break;
          }
          default: {
            throwSyntaxError(bytes, --i5);
          }
        }
        c2 = bytes[i5];
        while (c2 <= 32) {
          c2 = bytes[++i5];
        }
        switch (state) {
          case 0: {
            if (i5 === length) {
              return value;
            }
            break;
          }
          case 1: {
            object.push(value);
            if (c2 === 44) {
              i5++;
              continue;
            }
            if (c2 === 93) {
              continue;
            }
            break;
          }
          case 2: {
            if (property === null) {
              property = value;
              if (c2 === 58) {
                i5++;
                continue;
              }
            } else {
              object[property] = value;
              property = null;
              if (c2 === 44) {
                i5++;
                continue;
              }
              if (c2 === 125) {
                continue;
              }
            }
            break;
          }
        }
        break;
      }
      throwSyntaxError(bytes, i5);
    }
    var quote = JSON.stringify;
    var buildLogLevelDefault = "warning";
    var transformLogLevelDefault = "silent";
    function validateAndJoinStringArray(values, what) {
      const toJoin = [];
      for (const value of values) {
        validateStringValue(value, what);
        if (value.indexOf(",") >= 0) throw new Error(`Invalid ${what}: ${value}`);
        toJoin.push(value);
      }
      return toJoin.join(",");
    }
    var canBeAnything = () => null;
    var mustBeBoolean = (value) => typeof value === "boolean" ? null : "a boolean";
    var mustBeString = (value) => typeof value === "string" ? null : "a string";
    var mustBeRegExp = (value) => value instanceof RegExp ? null : "a RegExp object";
    var mustBeInteger = (value) => typeof value === "number" && value === (value | 0) ? null : "an integer";
    var mustBeValidPortNumber = (value) => typeof value === "number" && value === (value | 0) && value >= 0 && value <= 65535 ? null : "a valid port number";
    var mustBeFunction = (value) => typeof value === "function" ? null : "a function";
    var mustBeArray = (value) => Array.isArray(value) ? null : "an array";
    var mustBeArrayOfStrings = (value) => Array.isArray(value) && value.every((x) => typeof x === "string") ? null : "an array of strings";
    var mustBeObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value) ? null : "an object";
    var mustBeEntryPoints = (value) => typeof value === "object" && value !== null ? null : "an array or an object";
    var mustBeWebAssemblyModule = (value) => value instanceof WebAssembly.Module ? null : "a WebAssembly.Module";
    var mustBeObjectOrNull = (value) => typeof value === "object" && !Array.isArray(value) ? null : "an object or null";
    var mustBeStringOrBoolean = (value) => typeof value === "string" || typeof value === "boolean" ? null : "a string or a boolean";
    var mustBeStringOrObject = (value) => typeof value === "string" || typeof value === "object" && value !== null && !Array.isArray(value) ? null : "a string or an object";
    var mustBeStringOrArrayOfStrings = (value) => typeof value === "string" || Array.isArray(value) && value.every((x) => typeof x === "string") ? null : "a string or an array of strings";
    var mustBeStringOrUint8Array = (value) => typeof value === "string" || value instanceof Uint8Array ? null : "a string or a Uint8Array";
    var mustBeStringOrURL = (value) => typeof value === "string" || value instanceof URL ? null : "a string or a URL";
    function getFlag(object, keys, key, mustBeFn) {
      let value = object[key];
      keys[key + ""] = true;
      if (value === void 0) return void 0;
      let mustBe = mustBeFn(value);
      if (mustBe !== null) throw new Error(`${quote(key)} must be ${mustBe}`);
      return value;
    }
    function checkForInvalidFlags(object, keys, where) {
      for (let key in object) {
        if (!(key in keys)) {
          throw new Error(`Invalid option ${where}: ${quote(key)}`);
        }
      }
    }
    function validateInitializeOptions(options) {
      let keys = /* @__PURE__ */ Object.create(null);
      let wasmURL = getFlag(options, keys, "wasmURL", mustBeStringOrURL);
      let wasmModule = getFlag(options, keys, "wasmModule", mustBeWebAssemblyModule);
      let worker = getFlag(options, keys, "worker", mustBeBoolean);
      checkForInvalidFlags(options, keys, "in initialize() call");
      return {
        wasmURL,
        wasmModule,
        worker
      };
    }
    function validateMangleCache(mangleCache) {
      let validated;
      if (mangleCache !== void 0) {
        validated = /* @__PURE__ */ Object.create(null);
        for (let key in mangleCache) {
          let value = mangleCache[key];
          if (typeof value === "string" || value === false) {
            validated[key] = value;
          } else {
            throw new Error(`Expected ${quote(key)} in mangle cache to map to either a string or false`);
          }
        }
      }
      return validated;
    }
    function pushLogFlags(flags, options, keys, isTTY2, logLevelDefault) {
      let color = getFlag(options, keys, "color", mustBeBoolean);
      let logLevel = getFlag(options, keys, "logLevel", mustBeString);
      let logLimit = getFlag(options, keys, "logLimit", mustBeInteger);
      if (color !== void 0) flags.push(`--color=${color}`);
      else if (isTTY2) flags.push(`--color=true`);
      flags.push(`--log-level=${logLevel || logLevelDefault}`);
      flags.push(`--log-limit=${logLimit || 0}`);
    }
    function validateStringValue(value, what, key) {
      if (typeof value !== "string") {
        throw new Error(`Expected value for ${what}${key !== void 0 ? " " + quote(key) : ""} to be a string, got ${typeof value} instead`);
      }
      return value;
    }
    function pushCommonFlags(flags, options, keys) {
      let legalComments = getFlag(options, keys, "legalComments", mustBeString);
      let sourceRoot = getFlag(options, keys, "sourceRoot", mustBeString);
      let sourcesContent = getFlag(options, keys, "sourcesContent", mustBeBoolean);
      let target = getFlag(options, keys, "target", mustBeStringOrArrayOfStrings);
      let format = getFlag(options, keys, "format", mustBeString);
      let globalName = getFlag(options, keys, "globalName", mustBeString);
      let mangleProps = getFlag(options, keys, "mangleProps", mustBeRegExp);
      let reserveProps = getFlag(options, keys, "reserveProps", mustBeRegExp);
      let mangleQuoted = getFlag(options, keys, "mangleQuoted", mustBeBoolean);
      let minify = getFlag(options, keys, "minify", mustBeBoolean);
      let minifySyntax = getFlag(options, keys, "minifySyntax", mustBeBoolean);
      let minifyWhitespace = getFlag(options, keys, "minifyWhitespace", mustBeBoolean);
      let minifyIdentifiers = getFlag(options, keys, "minifyIdentifiers", mustBeBoolean);
      let lineLimit = getFlag(options, keys, "lineLimit", mustBeInteger);
      let drop = getFlag(options, keys, "drop", mustBeArrayOfStrings);
      let dropLabels = getFlag(options, keys, "dropLabels", mustBeArrayOfStrings);
      let charset = getFlag(options, keys, "charset", mustBeString);
      let treeShaking = getFlag(options, keys, "treeShaking", mustBeBoolean);
      let ignoreAnnotations = getFlag(options, keys, "ignoreAnnotations", mustBeBoolean);
      let jsx = getFlag(options, keys, "jsx", mustBeString);
      let jsxFactory = getFlag(options, keys, "jsxFactory", mustBeString);
      let jsxFragment = getFlag(options, keys, "jsxFragment", mustBeString);
      let jsxImportSource = getFlag(options, keys, "jsxImportSource", mustBeString);
      let jsxDev = getFlag(options, keys, "jsxDev", mustBeBoolean);
      let jsxSideEffects = getFlag(options, keys, "jsxSideEffects", mustBeBoolean);
      let define = getFlag(options, keys, "define", mustBeObject);
      let logOverride = getFlag(options, keys, "logOverride", mustBeObject);
      let supported = getFlag(options, keys, "supported", mustBeObject);
      let pure = getFlag(options, keys, "pure", mustBeArrayOfStrings);
      let keepNames = getFlag(options, keys, "keepNames", mustBeBoolean);
      let platform = getFlag(options, keys, "platform", mustBeString);
      let tsconfigRaw = getFlag(options, keys, "tsconfigRaw", mustBeStringOrObject);
      let absPaths = getFlag(options, keys, "absPaths", mustBeArrayOfStrings);
      if (legalComments) flags.push(`--legal-comments=${legalComments}`);
      if (sourceRoot !== void 0) flags.push(`--source-root=${sourceRoot}`);
      if (sourcesContent !== void 0) flags.push(`--sources-content=${sourcesContent}`);
      if (target) flags.push(`--target=${validateAndJoinStringArray(Array.isArray(target) ? target : [target], "target")}`);
      if (format) flags.push(`--format=${format}`);
      if (globalName) flags.push(`--global-name=${globalName}`);
      if (platform) flags.push(`--platform=${platform}`);
      if (tsconfigRaw) flags.push(`--tsconfig-raw=${typeof tsconfigRaw === "string" ? tsconfigRaw : JSON.stringify(tsconfigRaw)}`);
      if (minify) flags.push("--minify");
      if (minifySyntax) flags.push("--minify-syntax");
      if (minifyWhitespace) flags.push("--minify-whitespace");
      if (minifyIdentifiers) flags.push("--minify-identifiers");
      if (lineLimit) flags.push(`--line-limit=${lineLimit}`);
      if (charset) flags.push(`--charset=${charset}`);
      if (treeShaking !== void 0) flags.push(`--tree-shaking=${treeShaking}`);
      if (ignoreAnnotations) flags.push(`--ignore-annotations`);
      if (drop) for (let what of drop) flags.push(`--drop:${validateStringValue(what, "drop")}`);
      if (dropLabels) flags.push(`--drop-labels=${validateAndJoinStringArray(dropLabels, "drop label")}`);
      if (absPaths) flags.push(`--abs-paths=${validateAndJoinStringArray(absPaths, "abs paths")}`);
      if (mangleProps) flags.push(`--mangle-props=${jsRegExpToGoRegExp(mangleProps)}`);
      if (reserveProps) flags.push(`--reserve-props=${jsRegExpToGoRegExp(reserveProps)}`);
      if (mangleQuoted !== void 0) flags.push(`--mangle-quoted=${mangleQuoted}`);
      if (jsx) flags.push(`--jsx=${jsx}`);
      if (jsxFactory) flags.push(`--jsx-factory=${jsxFactory}`);
      if (jsxFragment) flags.push(`--jsx-fragment=${jsxFragment}`);
      if (jsxImportSource) flags.push(`--jsx-import-source=${jsxImportSource}`);
      if (jsxDev) flags.push(`--jsx-dev`);
      if (jsxSideEffects) flags.push(`--jsx-side-effects`);
      if (define) {
        for (let key in define) {
          if (key.indexOf("=") >= 0) throw new Error(`Invalid define: ${key}`);
          flags.push(`--define:${key}=${validateStringValue(define[key], "define", key)}`);
        }
      }
      if (logOverride) {
        for (let key in logOverride) {
          if (key.indexOf("=") >= 0) throw new Error(`Invalid log override: ${key}`);
          flags.push(`--log-override:${key}=${validateStringValue(logOverride[key], "log override", key)}`);
        }
      }
      if (supported) {
        for (let key in supported) {
          if (key.indexOf("=") >= 0) throw new Error(`Invalid supported: ${key}`);
          const value = supported[key];
          if (typeof value !== "boolean") throw new Error(`Expected value for supported ${quote(key)} to be a boolean, got ${typeof value} instead`);
          flags.push(`--supported:${key}=${value}`);
        }
      }
      if (pure) for (let fn2 of pure) flags.push(`--pure:${validateStringValue(fn2, "pure")}`);
      if (keepNames) flags.push(`--keep-names`);
    }
    function flagsForBuildOptions(callName, options, isTTY2, logLevelDefault, writeDefault) {
      var _a2;
      let flags = [];
      let entries = [];
      let keys = /* @__PURE__ */ Object.create(null);
      let stdinContents = null;
      let stdinResolveDir = null;
      pushLogFlags(flags, options, keys, isTTY2, logLevelDefault);
      pushCommonFlags(flags, options, keys);
      let sourcemap = getFlag(options, keys, "sourcemap", mustBeStringOrBoolean);
      let bundle = getFlag(options, keys, "bundle", mustBeBoolean);
      let splitting = getFlag(options, keys, "splitting", mustBeBoolean);
      let preserveSymlinks = getFlag(options, keys, "preserveSymlinks", mustBeBoolean);
      let metafile = getFlag(options, keys, "metafile", mustBeBoolean);
      let outfile = getFlag(options, keys, "outfile", mustBeString);
      let outdir = getFlag(options, keys, "outdir", mustBeString);
      let outbase = getFlag(options, keys, "outbase", mustBeString);
      let tsconfig = getFlag(options, keys, "tsconfig", mustBeString);
      let resolveExtensions = getFlag(options, keys, "resolveExtensions", mustBeArrayOfStrings);
      let nodePathsInput = getFlag(options, keys, "nodePaths", mustBeArrayOfStrings);
      let mainFields = getFlag(options, keys, "mainFields", mustBeArrayOfStrings);
      let conditions = getFlag(options, keys, "conditions", mustBeArrayOfStrings);
      let external = getFlag(options, keys, "external", mustBeArrayOfStrings);
      let packages = getFlag(options, keys, "packages", mustBeString);
      let alias = getFlag(options, keys, "alias", mustBeObject);
      let loader = getFlag(options, keys, "loader", mustBeObject);
      let outExtension = getFlag(options, keys, "outExtension", mustBeObject);
      let publicPath = getFlag(options, keys, "publicPath", mustBeString);
      let entryNames = getFlag(options, keys, "entryNames", mustBeString);
      let chunkNames = getFlag(options, keys, "chunkNames", mustBeString);
      let assetNames = getFlag(options, keys, "assetNames", mustBeString);
      let inject = getFlag(options, keys, "inject", mustBeArrayOfStrings);
      let banner = getFlag(options, keys, "banner", mustBeObject);
      let footer = getFlag(options, keys, "footer", mustBeObject);
      let entryPoints = getFlag(options, keys, "entryPoints", mustBeEntryPoints);
      let absWorkingDir = getFlag(options, keys, "absWorkingDir", mustBeString);
      let stdin = getFlag(options, keys, "stdin", mustBeObject);
      let write = (_a2 = getFlag(options, keys, "write", mustBeBoolean)) != null ? _a2 : writeDefault;
      let allowOverwrite = getFlag(options, keys, "allowOverwrite", mustBeBoolean);
      let mangleCache = getFlag(options, keys, "mangleCache", mustBeObject);
      keys.plugins = true;
      checkForInvalidFlags(options, keys, `in ${callName}() call`);
      if (sourcemap) flags.push(`--sourcemap${sourcemap === true ? "" : `=${sourcemap}`}`);
      if (bundle) flags.push("--bundle");
      if (allowOverwrite) flags.push("--allow-overwrite");
      if (splitting) flags.push("--splitting");
      if (preserveSymlinks) flags.push("--preserve-symlinks");
      if (metafile) flags.push(`--metafile`);
      if (outfile) flags.push(`--outfile=${outfile}`);
      if (outdir) flags.push(`--outdir=${outdir}`);
      if (outbase) flags.push(`--outbase=${outbase}`);
      if (tsconfig) flags.push(`--tsconfig=${tsconfig}`);
      if (packages) flags.push(`--packages=${packages}`);
      if (resolveExtensions) flags.push(`--resolve-extensions=${validateAndJoinStringArray(resolveExtensions, "resolve extension")}`);
      if (publicPath) flags.push(`--public-path=${publicPath}`);
      if (entryNames) flags.push(`--entry-names=${entryNames}`);
      if (chunkNames) flags.push(`--chunk-names=${chunkNames}`);
      if (assetNames) flags.push(`--asset-names=${assetNames}`);
      if (mainFields) flags.push(`--main-fields=${validateAndJoinStringArray(mainFields, "main field")}`);
      if (conditions) flags.push(`--conditions=${validateAndJoinStringArray(conditions, "condition")}`);
      if (external) for (let name of external) flags.push(`--external:${validateStringValue(name, "external")}`);
      if (alias) {
        for (let old in alias) {
          if (old.indexOf("=") >= 0) throw new Error(`Invalid package name in alias: ${old}`);
          flags.push(`--alias:${old}=${validateStringValue(alias[old], "alias", old)}`);
        }
      }
      if (banner) {
        for (let type in banner) {
          if (type.indexOf("=") >= 0) throw new Error(`Invalid banner file type: ${type}`);
          flags.push(`--banner:${type}=${validateStringValue(banner[type], "banner", type)}`);
        }
      }
      if (footer) {
        for (let type in footer) {
          if (type.indexOf("=") >= 0) throw new Error(`Invalid footer file type: ${type}`);
          flags.push(`--footer:${type}=${validateStringValue(footer[type], "footer", type)}`);
        }
      }
      if (inject) for (let path3 of inject) flags.push(`--inject:${validateStringValue(path3, "inject")}`);
      if (loader) {
        for (let ext in loader) {
          if (ext.indexOf("=") >= 0) throw new Error(`Invalid loader extension: ${ext}`);
          flags.push(`--loader:${ext}=${validateStringValue(loader[ext], "loader", ext)}`);
        }
      }
      if (outExtension) {
        for (let ext in outExtension) {
          if (ext.indexOf("=") >= 0) throw new Error(`Invalid out extension: ${ext}`);
          flags.push(`--out-extension:${ext}=${validateStringValue(outExtension[ext], "out extension", ext)}`);
        }
      }
      if (entryPoints) {
        if (Array.isArray(entryPoints)) {
          for (let i5 = 0, n2 = entryPoints.length; i5 < n2; i5++) {
            let entryPoint = entryPoints[i5];
            if (typeof entryPoint === "object" && entryPoint !== null) {
              let entryPointKeys = /* @__PURE__ */ Object.create(null);
              let input = getFlag(entryPoint, entryPointKeys, "in", mustBeString);
              let output = getFlag(entryPoint, entryPointKeys, "out", mustBeString);
              checkForInvalidFlags(entryPoint, entryPointKeys, "in entry point at index " + i5);
              if (input === void 0) throw new Error('Missing property "in" for entry point at index ' + i5);
              if (output === void 0) throw new Error('Missing property "out" for entry point at index ' + i5);
              entries.push([output, input]);
            } else {
              entries.push(["", validateStringValue(entryPoint, "entry point at index " + i5)]);
            }
          }
        } else {
          for (let key in entryPoints) {
            entries.push([key, validateStringValue(entryPoints[key], "entry point", key)]);
          }
        }
      }
      if (stdin) {
        let stdinKeys = /* @__PURE__ */ Object.create(null);
        let contents = getFlag(stdin, stdinKeys, "contents", mustBeStringOrUint8Array);
        let resolveDir = getFlag(stdin, stdinKeys, "resolveDir", mustBeString);
        let sourcefile = getFlag(stdin, stdinKeys, "sourcefile", mustBeString);
        let loader2 = getFlag(stdin, stdinKeys, "loader", mustBeString);
        checkForInvalidFlags(stdin, stdinKeys, 'in "stdin" object');
        if (sourcefile) flags.push(`--sourcefile=${sourcefile}`);
        if (loader2) flags.push(`--loader=${loader2}`);
        if (resolveDir) stdinResolveDir = resolveDir;
        if (typeof contents === "string") stdinContents = encodeUTF8(contents);
        else if (contents instanceof Uint8Array) stdinContents = contents;
      }
      let nodePaths = [];
      if (nodePathsInput) {
        for (let value of nodePathsInput) {
          value += "";
          nodePaths.push(value);
        }
      }
      return {
        entries,
        flags,
        write,
        stdinContents,
        stdinResolveDir,
        absWorkingDir,
        nodePaths,
        mangleCache: validateMangleCache(mangleCache)
      };
    }
    function flagsForTransformOptions(callName, options, isTTY2, logLevelDefault) {
      let flags = [];
      let keys = /* @__PURE__ */ Object.create(null);
      pushLogFlags(flags, options, keys, isTTY2, logLevelDefault);
      pushCommonFlags(flags, options, keys);
      let sourcemap = getFlag(options, keys, "sourcemap", mustBeStringOrBoolean);
      let sourcefile = getFlag(options, keys, "sourcefile", mustBeString);
      let loader = getFlag(options, keys, "loader", mustBeString);
      let banner = getFlag(options, keys, "banner", mustBeString);
      let footer = getFlag(options, keys, "footer", mustBeString);
      let mangleCache = getFlag(options, keys, "mangleCache", mustBeObject);
      checkForInvalidFlags(options, keys, `in ${callName}() call`);
      if (sourcemap) flags.push(`--sourcemap=${sourcemap === true ? "external" : sourcemap}`);
      if (sourcefile) flags.push(`--sourcefile=${sourcefile}`);
      if (loader) flags.push(`--loader=${loader}`);
      if (banner) flags.push(`--banner=${banner}`);
      if (footer) flags.push(`--footer=${footer}`);
      return {
        flags,
        mangleCache: validateMangleCache(mangleCache)
      };
    }
    function createChannel(streamIn) {
      const requestCallbacksByKey = {};
      const closeData = { didClose: false, reason: "" };
      let responseCallbacks = {};
      let nextRequestID = 0;
      let nextBuildKey = 0;
      let stdout = new Uint8Array(16 * 1024);
      let stdoutUsed = 0;
      let readFromStdout = (chunk) => {
        let limit = stdoutUsed + chunk.length;
        if (limit > stdout.length) {
          let swap = new Uint8Array(limit * 2);
          swap.set(stdout);
          stdout = swap;
        }
        stdout.set(chunk, stdoutUsed);
        stdoutUsed += chunk.length;
        let offset = 0;
        while (offset + 4 <= stdoutUsed) {
          let length = readUInt32LE(stdout, offset);
          if (offset + 4 + length > stdoutUsed) {
            break;
          }
          offset += 4;
          handleIncomingPacket(stdout.subarray(offset, offset + length));
          offset += length;
        }
        if (offset > 0) {
          stdout.copyWithin(0, offset, stdoutUsed);
          stdoutUsed -= offset;
        }
      };
      let afterClose = (error) => {
        closeData.didClose = true;
        if (error) closeData.reason = ": " + (error.message || error);
        const text = "The service was stopped" + closeData.reason;
        for (let id in responseCallbacks) {
          responseCallbacks[id](text, null);
        }
        responseCallbacks = {};
      };
      let sendRequest = (refs, value, callback) => {
        if (closeData.didClose) return callback("The service is no longer running" + closeData.reason, null);
        let id = nextRequestID++;
        responseCallbacks[id] = (error, response) => {
          try {
            callback(error, response);
          } finally {
            if (refs) refs.unref();
          }
        };
        if (refs) refs.ref();
        streamIn.writeToStdin(encodePacket({ id, isRequest: true, value }));
      };
      let sendResponse = (id, value) => {
        if (closeData.didClose) throw new Error("The service is no longer running" + closeData.reason);
        streamIn.writeToStdin(encodePacket({ id, isRequest: false, value }));
      };
      let handleRequest = async (id, request) => {
        try {
          if (request.command === "ping") {
            sendResponse(id, {});
            return;
          }
          if (typeof request.key === "number") {
            const requestCallbacks = requestCallbacksByKey[request.key];
            if (!requestCallbacks) {
              return;
            }
            const callback = requestCallbacks[request.command];
            if (callback) {
              await callback(id, request);
              return;
            }
          }
          throw new Error(`Invalid command: ` + request.command);
        } catch (e5) {
          const errors = [extractErrorMessageV8(e5, streamIn, null, void 0, "")];
          try {
            sendResponse(id, { errors });
          } catch {
          }
        }
      };
      let isFirstPacket = true;
      let handleIncomingPacket = (bytes) => {
        if (isFirstPacket) {
          isFirstPacket = false;
          let binaryVersion = String.fromCharCode(...bytes);
          if (binaryVersion !== "0.27.4") {
            throw new Error(`Cannot start service: Host version "${"0.27.4"}" does not match binary version ${quote(binaryVersion)}`);
          }
          return;
        }
        let packet = decodePacket(bytes);
        if (packet.isRequest) {
          handleRequest(packet.id, packet.value);
        } else {
          let callback = responseCallbacks[packet.id];
          delete responseCallbacks[packet.id];
          if (packet.value.error) callback(packet.value.error, {});
          else callback(null, packet.value);
        }
      };
      let buildOrContext = ({ callName, refs, options, isTTY: isTTY2, defaultWD: defaultWD2, callback }) => {
        let refCount = 0;
        const buildKey = nextBuildKey++;
        const requestCallbacks = {};
        const buildRefs = {
          ref() {
            if (++refCount === 1) {
              if (refs) refs.ref();
            }
          },
          unref() {
            if (--refCount === 0) {
              delete requestCallbacksByKey[buildKey];
              if (refs) refs.unref();
            }
          }
        };
        requestCallbacksByKey[buildKey] = requestCallbacks;
        buildRefs.ref();
        buildOrContextImpl(
          callName,
          buildKey,
          sendRequest,
          sendResponse,
          buildRefs,
          streamIn,
          requestCallbacks,
          options,
          isTTY2,
          defaultWD2,
          (err, res) => {
            try {
              callback(err, res);
            } finally {
              buildRefs.unref();
            }
          }
        );
      };
      let transform2 = ({ callName, refs, input, options, isTTY: isTTY2, fs: fs3, callback }) => {
        const details = createObjectStash();
        let start = (inputPath) => {
          try {
            if (typeof input !== "string" && !(input instanceof Uint8Array))
              throw new Error('The input to "transform" must be a string or a Uint8Array');
            let {
              flags,
              mangleCache
            } = flagsForTransformOptions(callName, options, isTTY2, transformLogLevelDefault);
            let request = {
              command: "transform",
              flags,
              inputFS: inputPath !== null,
              input: inputPath !== null ? encodeUTF8(inputPath) : typeof input === "string" ? encodeUTF8(input) : input
            };
            if (mangleCache) request.mangleCache = mangleCache;
            sendRequest(refs, request, (error, response) => {
              if (error) return callback(new Error(error), null);
              let errors = replaceDetailsInMessages(response.errors, details);
              let warnings = replaceDetailsInMessages(response.warnings, details);
              let outstanding = 1;
              let next = () => {
                if (--outstanding === 0) {
                  let result = {
                    warnings,
                    code: response.code,
                    map: response.map,
                    mangleCache: void 0,
                    legalComments: void 0
                  };
                  if ("legalComments" in response) result.legalComments = response == null ? void 0 : response.legalComments;
                  if (response.mangleCache) result.mangleCache = response == null ? void 0 : response.mangleCache;
                  callback(null, result);
                }
              };
              if (errors.length > 0) return callback(failureErrorWithLog("Transform failed", errors, warnings), null);
              if (response.codeFS) {
                outstanding++;
                fs3.readFile(response.code, (err, contents) => {
                  if (err !== null) {
                    callback(err, null);
                  } else {
                    response.code = contents;
                    next();
                  }
                });
              }
              if (response.mapFS) {
                outstanding++;
                fs3.readFile(response.map, (err, contents) => {
                  if (err !== null) {
                    callback(err, null);
                  } else {
                    response.map = contents;
                    next();
                  }
                });
              }
              next();
            });
          } catch (e5) {
            let flags = [];
            try {
              pushLogFlags(flags, options, {}, isTTY2, transformLogLevelDefault);
            } catch {
            }
            const error = extractErrorMessageV8(e5, streamIn, details, void 0, "");
            sendRequest(refs, { command: "error", flags, error }, () => {
              error.detail = details.load(error.detail);
              callback(failureErrorWithLog("Transform failed", [error], []), null);
            });
          }
        };
        if ((typeof input === "string" || input instanceof Uint8Array) && input.length > 1024 * 1024) {
          let next = start;
          start = () => fs3.writeFile(input, next);
        }
        start(null);
      };
      let formatMessages2 = ({ callName, refs, messages, options, callback }) => {
        if (!options) throw new Error(`Missing second argument in ${callName}() call`);
        let keys = {};
        let kind = getFlag(options, keys, "kind", mustBeString);
        let color = getFlag(options, keys, "color", mustBeBoolean);
        let terminalWidth = getFlag(options, keys, "terminalWidth", mustBeInteger);
        checkForInvalidFlags(options, keys, `in ${callName}() call`);
        if (kind === void 0) throw new Error(`Missing "kind" in ${callName}() call`);
        if (kind !== "error" && kind !== "warning") throw new Error(`Expected "kind" to be "error" or "warning" in ${callName}() call`);
        let request = {
          command: "format-msgs",
          messages: sanitizeMessages(messages, "messages", null, "", terminalWidth),
          isWarning: kind === "warning"
        };
        if (color !== void 0) request.color = color;
        if (terminalWidth !== void 0) request.terminalWidth = terminalWidth;
        sendRequest(refs, request, (error, response) => {
          if (error) return callback(new Error(error), null);
          callback(null, response.messages);
        });
      };
      let analyzeMetafile2 = ({ callName, refs, metafile, options, callback }) => {
        if (options === void 0) options = {};
        let keys = {};
        let color = getFlag(options, keys, "color", mustBeBoolean);
        let verbose = getFlag(options, keys, "verbose", mustBeBoolean);
        checkForInvalidFlags(options, keys, `in ${callName}() call`);
        let request = {
          command: "analyze-metafile",
          metafile
        };
        if (color !== void 0) request.color = color;
        if (verbose !== void 0) request.verbose = verbose;
        sendRequest(refs, request, (error, response) => {
          if (error) return callback(new Error(error), null);
          callback(null, response.result);
        });
      };
      return {
        readFromStdout,
        afterClose,
        service: {
          buildOrContext,
          transform: transform2,
          formatMessages: formatMessages2,
          analyzeMetafile: analyzeMetafile2
        }
      };
    }
    function buildOrContextImpl(callName, buildKey, sendRequest, sendResponse, refs, streamIn, requestCallbacks, options, isTTY2, defaultWD2, callback) {
      const details = createObjectStash();
      const isContext = callName === "context";
      const handleError = (e5, pluginName) => {
        const flags = [];
        try {
          pushLogFlags(flags, options, {}, isTTY2, buildLogLevelDefault);
        } catch {
        }
        const message = extractErrorMessageV8(e5, streamIn, details, void 0, pluginName);
        sendRequest(refs, { command: "error", flags, error: message }, () => {
          message.detail = details.load(message.detail);
          callback(failureErrorWithLog(isContext ? "Context failed" : "Build failed", [message], []), null);
        });
      };
      let plugins;
      if (typeof options === "object") {
        const value = options.plugins;
        if (value !== void 0) {
          if (!Array.isArray(value)) return handleError(new Error(`"plugins" must be an array`), "");
          plugins = value;
        }
      }
      if (plugins && plugins.length > 0) {
        if (streamIn.isSync) return handleError(new Error("Cannot use plugins in synchronous API calls"), "");
        handlePlugins(
          buildKey,
          sendRequest,
          sendResponse,
          refs,
          streamIn,
          requestCallbacks,
          options,
          plugins,
          details
        ).then(
          (result) => {
            if (!result.ok) return handleError(result.error, result.pluginName);
            try {
              buildOrContextContinue(result.requestPlugins, result.runOnEndCallbacks, result.scheduleOnDisposeCallbacks);
            } catch (e5) {
              handleError(e5, "");
            }
          },
          (e5) => handleError(e5, "")
        );
        return;
      }
      try {
        buildOrContextContinue(null, (result, done) => done([], []), () => {
        });
      } catch (e5) {
        handleError(e5, "");
      }
      function buildOrContextContinue(requestPlugins, runOnEndCallbacks, scheduleOnDisposeCallbacks) {
        const writeDefault = streamIn.hasFS;
        const {
          entries,
          flags,
          write,
          stdinContents,
          stdinResolveDir,
          absWorkingDir,
          nodePaths,
          mangleCache
        } = flagsForBuildOptions(callName, options, isTTY2, buildLogLevelDefault, writeDefault);
        if (write && !streamIn.hasFS) throw new Error(`The "write" option is unavailable in this environment`);
        const request = {
          command: "build",
          key: buildKey,
          entries,
          flags,
          write,
          stdinContents,
          stdinResolveDir,
          absWorkingDir: absWorkingDir || defaultWD2,
          nodePaths,
          context: isContext
        };
        if (requestPlugins) request.plugins = requestPlugins;
        if (mangleCache) request.mangleCache = mangleCache;
        const buildResponseToResult = (response, callback2) => {
          const result = {
            errors: replaceDetailsInMessages(response.errors, details),
            warnings: replaceDetailsInMessages(response.warnings, details),
            outputFiles: void 0,
            metafile: void 0,
            mangleCache: void 0
          };
          const originalErrors = result.errors.slice();
          const originalWarnings = result.warnings.slice();
          if (response.outputFiles) result.outputFiles = response.outputFiles.map(convertOutputFiles);
          if (response.metafile) result.metafile = parseJSON(response.metafile);
          if (response.mangleCache) result.mangleCache = response.mangleCache;
          if (response.writeToStdout !== void 0) console.log(decodeUTF8(response.writeToStdout).replace(/\n$/, ""));
          runOnEndCallbacks(result, (onEndErrors, onEndWarnings) => {
            if (originalErrors.length > 0 || onEndErrors.length > 0) {
              const error = failureErrorWithLog("Build failed", originalErrors.concat(onEndErrors), originalWarnings.concat(onEndWarnings));
              return callback2(error, null, onEndErrors, onEndWarnings);
            }
            callback2(null, result, onEndErrors, onEndWarnings);
          });
        };
        let latestResultPromise;
        let provideLatestResult;
        if (isContext)
          requestCallbacks["on-end"] = (id, request2) => new Promise((resolve) => {
            buildResponseToResult(request2, (err, result, onEndErrors, onEndWarnings) => {
              const response = {
                errors: onEndErrors,
                warnings: onEndWarnings
              };
              if (provideLatestResult) provideLatestResult(err, result);
              latestResultPromise = void 0;
              provideLatestResult = void 0;
              sendResponse(id, response);
              resolve();
            });
          });
        sendRequest(refs, request, (error, response) => {
          if (error) return callback(new Error(error), null);
          if (!isContext) {
            return buildResponseToResult(response, (err, res) => {
              scheduleOnDisposeCallbacks();
              return callback(err, res);
            });
          }
          if (response.errors.length > 0) {
            return callback(failureErrorWithLog("Context failed", response.errors, response.warnings), null);
          }
          let didDispose = false;
          const result = {
            rebuild: () => {
              if (!latestResultPromise) latestResultPromise = new Promise((resolve, reject) => {
                let settlePromise;
                provideLatestResult = (err, result2) => {
                  if (!settlePromise) settlePromise = () => err ? reject(err) : resolve(result2);
                };
                const triggerAnotherBuild = () => {
                  const request2 = {
                    command: "rebuild",
                    key: buildKey
                  };
                  sendRequest(refs, request2, (error2, response2) => {
                    if (error2) {
                      reject(new Error(error2));
                    } else if (settlePromise) {
                      settlePromise();
                    } else {
                      triggerAnotherBuild();
                    }
                  });
                };
                triggerAnotherBuild();
              });
              return latestResultPromise;
            },
            watch: (options2 = {}) => new Promise((resolve, reject) => {
              if (!streamIn.hasFS) throw new Error(`Cannot use the "watch" API in this environment`);
              const keys = {};
              const delay = getFlag(options2, keys, "delay", mustBeInteger);
              checkForInvalidFlags(options2, keys, `in watch() call`);
              const request2 = {
                command: "watch",
                key: buildKey
              };
              if (delay) request2.delay = delay;
              sendRequest(refs, request2, (error2) => {
                if (error2) reject(new Error(error2));
                else resolve(void 0);
              });
            }),
            serve: (options2 = {}) => new Promise((resolve, reject) => {
              if (!streamIn.hasFS) throw new Error(`Cannot use the "serve" API in this environment`);
              const keys = {};
              const port = getFlag(options2, keys, "port", mustBeValidPortNumber);
              const host = getFlag(options2, keys, "host", mustBeString);
              const servedir = getFlag(options2, keys, "servedir", mustBeString);
              const keyfile = getFlag(options2, keys, "keyfile", mustBeString);
              const certfile = getFlag(options2, keys, "certfile", mustBeString);
              const fallback = getFlag(options2, keys, "fallback", mustBeString);
              const cors = getFlag(options2, keys, "cors", mustBeObject);
              const onRequest = getFlag(options2, keys, "onRequest", mustBeFunction);
              checkForInvalidFlags(options2, keys, `in serve() call`);
              const request2 = {
                command: "serve",
                key: buildKey,
                onRequest: !!onRequest
              };
              if (port !== void 0) request2.port = port;
              if (host !== void 0) request2.host = host;
              if (servedir !== void 0) request2.servedir = servedir;
              if (keyfile !== void 0) request2.keyfile = keyfile;
              if (certfile !== void 0) request2.certfile = certfile;
              if (fallback !== void 0) request2.fallback = fallback;
              if (cors) {
                const corsKeys = {};
                const origin = getFlag(cors, corsKeys, "origin", mustBeStringOrArrayOfStrings);
                checkForInvalidFlags(cors, corsKeys, `on "cors" object`);
                if (Array.isArray(origin)) request2.corsOrigin = origin;
                else if (origin !== void 0) request2.corsOrigin = [origin];
              }
              sendRequest(refs, request2, (error2, response2) => {
                if (error2) return reject(new Error(error2));
                if (onRequest) {
                  requestCallbacks["serve-request"] = (id, request3) => {
                    onRequest(request3.args);
                    sendResponse(id, {});
                  };
                }
                resolve(response2);
              });
            }),
            cancel: () => new Promise((resolve) => {
              if (didDispose) return resolve();
              const request2 = {
                command: "cancel",
                key: buildKey
              };
              sendRequest(refs, request2, () => {
                resolve();
              });
            }),
            dispose: () => new Promise((resolve) => {
              if (didDispose) return resolve();
              didDispose = true;
              const request2 = {
                command: "dispose",
                key: buildKey
              };
              sendRequest(refs, request2, () => {
                resolve();
                scheduleOnDisposeCallbacks();
                refs.unref();
              });
            })
          };
          refs.ref();
          callback(null, result);
        });
      }
    }
    var handlePlugins = async (buildKey, sendRequest, sendResponse, refs, streamIn, requestCallbacks, initialOptions, plugins, details) => {
      let onStartCallbacks = [];
      let onEndCallbacks = [];
      let onResolveCallbacks = {};
      let onLoadCallbacks = {};
      let onDisposeCallbacks = [];
      let nextCallbackID = 0;
      let i5 = 0;
      let requestPlugins = [];
      let isSetupDone = false;
      plugins = [...plugins];
      for (let item of plugins) {
        let keys = {};
        if (typeof item !== "object") throw new Error(`Plugin at index ${i5} must be an object`);
        const name = getFlag(item, keys, "name", mustBeString);
        if (typeof name !== "string" || name === "") throw new Error(`Plugin at index ${i5} is missing a name`);
        try {
          let setup = getFlag(item, keys, "setup", mustBeFunction);
          if (typeof setup !== "function") throw new Error(`Plugin is missing a setup function`);
          checkForInvalidFlags(item, keys, `on plugin ${quote(name)}`);
          let plugin = {
            name,
            onStart: false,
            onEnd: false,
            onResolve: [],
            onLoad: []
          };
          i5++;
          let resolve = (path3, options = {}) => {
            if (!isSetupDone) throw new Error('Cannot call "resolve" before plugin setup has completed');
            if (typeof path3 !== "string") throw new Error(`The path to resolve must be a string`);
            let keys2 = /* @__PURE__ */ Object.create(null);
            let pluginName = getFlag(options, keys2, "pluginName", mustBeString);
            let importer = getFlag(options, keys2, "importer", mustBeString);
            let namespace = getFlag(options, keys2, "namespace", mustBeString);
            let resolveDir = getFlag(options, keys2, "resolveDir", mustBeString);
            let kind = getFlag(options, keys2, "kind", mustBeString);
            let pluginData = getFlag(options, keys2, "pluginData", canBeAnything);
            let importAttributes = getFlag(options, keys2, "with", mustBeObject);
            checkForInvalidFlags(options, keys2, "in resolve() call");
            return new Promise((resolve2, reject) => {
              const request = {
                command: "resolve",
                path: path3,
                key: buildKey,
                pluginName: name
              };
              if (pluginName != null) request.pluginName = pluginName;
              if (importer != null) request.importer = importer;
              if (namespace != null) request.namespace = namespace;
              if (resolveDir != null) request.resolveDir = resolveDir;
              if (kind != null) request.kind = kind;
              else throw new Error(`Must specify "kind" when calling "resolve"`);
              if (pluginData != null) request.pluginData = details.store(pluginData);
              if (importAttributes != null) request.with = sanitizeStringMap(importAttributes, "with");
              sendRequest(refs, request, (error, response) => {
                if (error !== null) reject(new Error(error));
                else resolve2({
                  errors: replaceDetailsInMessages(response.errors, details),
                  warnings: replaceDetailsInMessages(response.warnings, details),
                  path: response.path,
                  external: response.external,
                  sideEffects: response.sideEffects,
                  namespace: response.namespace,
                  suffix: response.suffix,
                  pluginData: details.load(response.pluginData)
                });
              });
            });
          };
          let promise = setup({
            initialOptions,
            resolve,
            onStart(callback) {
              let registeredText = `This error came from the "onStart" callback registered here:`;
              let registeredNote = extractCallerV8(new Error(registeredText), streamIn, "onStart");
              onStartCallbacks.push({ name, callback, note: registeredNote });
              plugin.onStart = true;
            },
            onEnd(callback) {
              let registeredText = `This error came from the "onEnd" callback registered here:`;
              let registeredNote = extractCallerV8(new Error(registeredText), streamIn, "onEnd");
              onEndCallbacks.push({ name, callback, note: registeredNote });
              plugin.onEnd = true;
            },
            onResolve(options, callback) {
              let registeredText = `This error came from the "onResolve" callback registered here:`;
              let registeredNote = extractCallerV8(new Error(registeredText), streamIn, "onResolve");
              let keys2 = {};
              let filter = getFlag(options, keys2, "filter", mustBeRegExp);
              let namespace = getFlag(options, keys2, "namespace", mustBeString);
              checkForInvalidFlags(options, keys2, `in onResolve() call for plugin ${quote(name)}`);
              if (filter == null) throw new Error(`onResolve() call is missing a filter`);
              let id = nextCallbackID++;
              onResolveCallbacks[id] = { name, callback, note: registeredNote };
              plugin.onResolve.push({ id, filter: jsRegExpToGoRegExp(filter), namespace: namespace || "" });
            },
            onLoad(options, callback) {
              let registeredText = `This error came from the "onLoad" callback registered here:`;
              let registeredNote = extractCallerV8(new Error(registeredText), streamIn, "onLoad");
              let keys2 = {};
              let filter = getFlag(options, keys2, "filter", mustBeRegExp);
              let namespace = getFlag(options, keys2, "namespace", mustBeString);
              checkForInvalidFlags(options, keys2, `in onLoad() call for plugin ${quote(name)}`);
              if (filter == null) throw new Error(`onLoad() call is missing a filter`);
              let id = nextCallbackID++;
              onLoadCallbacks[id] = { name, callback, note: registeredNote };
              plugin.onLoad.push({ id, filter: jsRegExpToGoRegExp(filter), namespace: namespace || "" });
            },
            onDispose(callback) {
              onDisposeCallbacks.push(callback);
            },
            esbuild: streamIn.esbuild
          });
          if (promise) await promise;
          requestPlugins.push(plugin);
        } catch (e5) {
          return { ok: false, error: e5, pluginName: name };
        }
      }
      requestCallbacks["on-start"] = async (id, request) => {
        details.clear();
        let response = { errors: [], warnings: [] };
        await Promise.all(onStartCallbacks.map(async ({ name, callback, note }) => {
          try {
            let result = await callback();
            if (result != null) {
              if (typeof result !== "object") throw new Error(`Expected onStart() callback in plugin ${quote(name)} to return an object`);
              let keys = {};
              let errors = getFlag(result, keys, "errors", mustBeArray);
              let warnings = getFlag(result, keys, "warnings", mustBeArray);
              checkForInvalidFlags(result, keys, `from onStart() callback in plugin ${quote(name)}`);
              if (errors != null) response.errors.push(...sanitizeMessages(errors, "errors", details, name, void 0));
              if (warnings != null) response.warnings.push(...sanitizeMessages(warnings, "warnings", details, name, void 0));
            }
          } catch (e5) {
            response.errors.push(extractErrorMessageV8(e5, streamIn, details, note && note(), name));
          }
        }));
        sendResponse(id, response);
      };
      requestCallbacks["on-resolve"] = async (id, request) => {
        let response = {}, name = "", callback, note;
        for (let id2 of request.ids) {
          try {
            ({ name, callback, note } = onResolveCallbacks[id2]);
            let result = await callback({
              path: request.path,
              importer: request.importer,
              namespace: request.namespace,
              resolveDir: request.resolveDir,
              kind: request.kind,
              pluginData: details.load(request.pluginData),
              with: request.with
            });
            if (result != null) {
              if (typeof result !== "object") throw new Error(`Expected onResolve() callback in plugin ${quote(name)} to return an object`);
              let keys = {};
              let pluginName = getFlag(result, keys, "pluginName", mustBeString);
              let path3 = getFlag(result, keys, "path", mustBeString);
              let namespace = getFlag(result, keys, "namespace", mustBeString);
              let suffix = getFlag(result, keys, "suffix", mustBeString);
              let external = getFlag(result, keys, "external", mustBeBoolean);
              let sideEffects = getFlag(result, keys, "sideEffects", mustBeBoolean);
              let pluginData = getFlag(result, keys, "pluginData", canBeAnything);
              let errors = getFlag(result, keys, "errors", mustBeArray);
              let warnings = getFlag(result, keys, "warnings", mustBeArray);
              let watchFiles = getFlag(result, keys, "watchFiles", mustBeArrayOfStrings);
              let watchDirs = getFlag(result, keys, "watchDirs", mustBeArrayOfStrings);
              checkForInvalidFlags(result, keys, `from onResolve() callback in plugin ${quote(name)}`);
              response.id = id2;
              if (pluginName != null) response.pluginName = pluginName;
              if (path3 != null) response.path = path3;
              if (namespace != null) response.namespace = namespace;
              if (suffix != null) response.suffix = suffix;
              if (external != null) response.external = external;
              if (sideEffects != null) response.sideEffects = sideEffects;
              if (pluginData != null) response.pluginData = details.store(pluginData);
              if (errors != null) response.errors = sanitizeMessages(errors, "errors", details, name, void 0);
              if (warnings != null) response.warnings = sanitizeMessages(warnings, "warnings", details, name, void 0);
              if (watchFiles != null) response.watchFiles = sanitizeStringArray(watchFiles, "watchFiles");
              if (watchDirs != null) response.watchDirs = sanitizeStringArray(watchDirs, "watchDirs");
              break;
            }
          } catch (e5) {
            response = { id: id2, errors: [extractErrorMessageV8(e5, streamIn, details, note && note(), name)] };
            break;
          }
        }
        sendResponse(id, response);
      };
      requestCallbacks["on-load"] = async (id, request) => {
        let response = {}, name = "", callback, note;
        for (let id2 of request.ids) {
          try {
            ({ name, callback, note } = onLoadCallbacks[id2]);
            let result = await callback({
              path: request.path,
              namespace: request.namespace,
              suffix: request.suffix,
              pluginData: details.load(request.pluginData),
              with: request.with
            });
            if (result != null) {
              if (typeof result !== "object") throw new Error(`Expected onLoad() callback in plugin ${quote(name)} to return an object`);
              let keys = {};
              let pluginName = getFlag(result, keys, "pluginName", mustBeString);
              let contents = getFlag(result, keys, "contents", mustBeStringOrUint8Array);
              let resolveDir = getFlag(result, keys, "resolveDir", mustBeString);
              let pluginData = getFlag(result, keys, "pluginData", canBeAnything);
              let loader = getFlag(result, keys, "loader", mustBeString);
              let errors = getFlag(result, keys, "errors", mustBeArray);
              let warnings = getFlag(result, keys, "warnings", mustBeArray);
              let watchFiles = getFlag(result, keys, "watchFiles", mustBeArrayOfStrings);
              let watchDirs = getFlag(result, keys, "watchDirs", mustBeArrayOfStrings);
              checkForInvalidFlags(result, keys, `from onLoad() callback in plugin ${quote(name)}`);
              response.id = id2;
              if (pluginName != null) response.pluginName = pluginName;
              if (contents instanceof Uint8Array) response.contents = contents;
              else if (contents != null) response.contents = encodeUTF8(contents);
              if (resolveDir != null) response.resolveDir = resolveDir;
              if (pluginData != null) response.pluginData = details.store(pluginData);
              if (loader != null) response.loader = loader;
              if (errors != null) response.errors = sanitizeMessages(errors, "errors", details, name, void 0);
              if (warnings != null) response.warnings = sanitizeMessages(warnings, "warnings", details, name, void 0);
              if (watchFiles != null) response.watchFiles = sanitizeStringArray(watchFiles, "watchFiles");
              if (watchDirs != null) response.watchDirs = sanitizeStringArray(watchDirs, "watchDirs");
              break;
            }
          } catch (e5) {
            response = { id: id2, errors: [extractErrorMessageV8(e5, streamIn, details, note && note(), name)] };
            break;
          }
        }
        sendResponse(id, response);
      };
      let runOnEndCallbacks = (result, done) => done([], []);
      if (onEndCallbacks.length > 0) {
        runOnEndCallbacks = (result, done) => {
          (async () => {
            const onEndErrors = [];
            const onEndWarnings = [];
            for (const { name, callback, note } of onEndCallbacks) {
              let newErrors;
              let newWarnings;
              try {
                const value = await callback(result);
                if (value != null) {
                  if (typeof value !== "object") throw new Error(`Expected onEnd() callback in plugin ${quote(name)} to return an object`);
                  let keys = {};
                  let errors = getFlag(value, keys, "errors", mustBeArray);
                  let warnings = getFlag(value, keys, "warnings", mustBeArray);
                  checkForInvalidFlags(value, keys, `from onEnd() callback in plugin ${quote(name)}`);
                  if (errors != null) newErrors = sanitizeMessages(errors, "errors", details, name, void 0);
                  if (warnings != null) newWarnings = sanitizeMessages(warnings, "warnings", details, name, void 0);
                }
              } catch (e5) {
                newErrors = [extractErrorMessageV8(e5, streamIn, details, note && note(), name)];
              }
              if (newErrors) {
                onEndErrors.push(...newErrors);
                try {
                  result.errors.push(...newErrors);
                } catch {
                }
              }
              if (newWarnings) {
                onEndWarnings.push(...newWarnings);
                try {
                  result.warnings.push(...newWarnings);
                } catch {
                }
              }
            }
            done(onEndErrors, onEndWarnings);
          })();
        };
      }
      let scheduleOnDisposeCallbacks = () => {
        for (const cb of onDisposeCallbacks) {
          setTimeout(() => cb(), 0);
        }
      };
      isSetupDone = true;
      return {
        ok: true,
        requestPlugins,
        runOnEndCallbacks,
        scheduleOnDisposeCallbacks
      };
    };
    function createObjectStash() {
      const map = /* @__PURE__ */ new Map();
      let nextID = 0;
      return {
        clear() {
          map.clear();
        },
        load(id) {
          return map.get(id);
        },
        store(value) {
          if (value === void 0) return -1;
          const id = nextID++;
          map.set(id, value);
          return id;
        }
      };
    }
    function extractCallerV8(e5, streamIn, ident) {
      let note;
      let tried = false;
      return () => {
        if (tried) return note;
        tried = true;
        try {
          let lines = (e5.stack + "").split("\n");
          lines.splice(1, 1);
          let location = parseStackLinesV8(streamIn, lines, ident);
          if (location) {
            note = { text: e5.message, location };
            return note;
          }
        } catch {
        }
      };
    }
    function extractErrorMessageV8(e5, streamIn, stash, note, pluginName) {
      let text = "Internal error";
      let location = null;
      try {
        text = (e5 && e5.message || e5) + "";
      } catch {
      }
      try {
        location = parseStackLinesV8(streamIn, (e5.stack + "").split("\n"), "");
      } catch {
      }
      return { id: "", pluginName, text, location, notes: note ? [note] : [], detail: stash ? stash.store(e5) : -1 };
    }
    function parseStackLinesV8(streamIn, lines, ident) {
      let at2 = "    at ";
      if (streamIn.readFileSync && !lines[0].startsWith(at2) && lines[1].startsWith(at2)) {
        for (let i5 = 1; i5 < lines.length; i5++) {
          let line = lines[i5];
          if (!line.startsWith(at2)) continue;
          line = line.slice(at2.length);
          while (true) {
            let match = /^(?:new |async )?\S+ \((.*)\)$/.exec(line);
            if (match) {
              line = match[1];
              continue;
            }
            match = /^eval at \S+ \((.*)\)(?:, \S+:\d+:\d+)?$/.exec(line);
            if (match) {
              line = match[1];
              continue;
            }
            match = /^(\S+):(\d+):(\d+)$/.exec(line);
            if (match) {
              let contents;
              try {
                contents = streamIn.readFileSync(match[1], "utf8");
              } catch {
                break;
              }
              let lineText = contents.split(/\r\n|\r|\n|\u2028|\u2029/)[+match[2] - 1] || "";
              let column = +match[3] - 1;
              let length = lineText.slice(column, column + ident.length) === ident ? ident.length : 0;
              return {
                file: match[1],
                namespace: "file",
                line: +match[2],
                column: encodeUTF8(lineText.slice(0, column)).length,
                length: encodeUTF8(lineText.slice(column, column + length)).length,
                lineText: lineText + "\n" + lines.slice(1).join("\n"),
                suggestion: ""
              };
            }
            break;
          }
        }
      }
      return null;
    }
    function failureErrorWithLog(text, errors, warnings) {
      let limit = 5;
      text += errors.length < 1 ? "" : ` with ${errors.length} error${errors.length < 2 ? "" : "s"}:` + errors.slice(0, limit + 1).map((e5, i5) => {
        if (i5 === limit) return "\n...";
        if (!e5.location) return `
error: ${e5.text}`;
        let { file, line, column } = e5.location;
        let pluginText = e5.pluginName ? `[plugin: ${e5.pluginName}] ` : "";
        return `
${file}:${line}:${column}: ERROR: ${pluginText}${e5.text}`;
      }).join("");
      let error = new Error(text);
      for (const [key, value] of [["errors", errors], ["warnings", warnings]]) {
        Object.defineProperty(error, key, {
          configurable: true,
          enumerable: true,
          get: () => value,
          set: (value2) => Object.defineProperty(error, key, {
            configurable: true,
            enumerable: true,
            value: value2
          })
        });
      }
      return error;
    }
    function replaceDetailsInMessages(messages, stash) {
      for (const message of messages) {
        message.detail = stash.load(message.detail);
      }
      return messages;
    }
    function sanitizeLocation(location, where, terminalWidth) {
      if (location == null) return null;
      let keys = {};
      let file = getFlag(location, keys, "file", mustBeString);
      let namespace = getFlag(location, keys, "namespace", mustBeString);
      let line = getFlag(location, keys, "line", mustBeInteger);
      let column = getFlag(location, keys, "column", mustBeInteger);
      let length = getFlag(location, keys, "length", mustBeInteger);
      let lineText = getFlag(location, keys, "lineText", mustBeString);
      let suggestion = getFlag(location, keys, "suggestion", mustBeString);
      checkForInvalidFlags(location, keys, where);
      if (lineText) {
        const relevantASCII = lineText.slice(
          0,
          (column && column > 0 ? column : 0) + (length && length > 0 ? length : 0) + (terminalWidth && terminalWidth > 0 ? terminalWidth : 80)
        );
        if (!/[\x7F-\uFFFF]/.test(relevantASCII) && !/\n/.test(lineText)) {
          lineText = relevantASCII;
        }
      }
      return {
        file: file || "",
        namespace: namespace || "",
        line: line || 0,
        column: column || 0,
        length: length || 0,
        lineText: lineText || "",
        suggestion: suggestion || ""
      };
    }
    function sanitizeMessages(messages, property, stash, fallbackPluginName, terminalWidth) {
      let messagesClone = [];
      let index = 0;
      for (const message of messages) {
        let keys = {};
        let id = getFlag(message, keys, "id", mustBeString);
        let pluginName = getFlag(message, keys, "pluginName", mustBeString);
        let text = getFlag(message, keys, "text", mustBeString);
        let location = getFlag(message, keys, "location", mustBeObjectOrNull);
        let notes = getFlag(message, keys, "notes", mustBeArray);
        let detail = getFlag(message, keys, "detail", canBeAnything);
        let where = `in element ${index} of "${property}"`;
        checkForInvalidFlags(message, keys, where);
        let notesClone = [];
        if (notes) {
          for (const note of notes) {
            let noteKeys = {};
            let noteText = getFlag(note, noteKeys, "text", mustBeString);
            let noteLocation = getFlag(note, noteKeys, "location", mustBeObjectOrNull);
            checkForInvalidFlags(note, noteKeys, where);
            notesClone.push({
              text: noteText || "",
              location: sanitizeLocation(noteLocation, where, terminalWidth)
            });
          }
        }
        messagesClone.push({
          id: id || "",
          pluginName: pluginName || fallbackPluginName,
          text: text || "",
          location: sanitizeLocation(location, where, terminalWidth),
          notes: notesClone,
          detail: stash ? stash.store(detail) : -1
        });
        index++;
      }
      return messagesClone;
    }
    function sanitizeStringArray(values, property) {
      const result = [];
      for (const value of values) {
        if (typeof value !== "string") throw new Error(`${quote(property)} must be an array of strings`);
        result.push(value);
      }
      return result;
    }
    function sanitizeStringMap(map, property) {
      const result = /* @__PURE__ */ Object.create(null);
      for (const key in map) {
        const value = map[key];
        if (typeof value !== "string") throw new Error(`key ${quote(key)} in object ${quote(property)} must be a string`);
        result[key] = value;
      }
      return result;
    }
    function convertOutputFiles({ path: path3, contents, hash }) {
      let text = null;
      return {
        path: path3,
        contents,
        hash,
        get text() {
          const binary = this.contents;
          if (text === null || binary !== contents) {
            contents = binary;
            text = decodeUTF8(binary);
          }
          return text;
        }
      };
    }
    function jsRegExpToGoRegExp(regexp) {
      let result = regexp.source;
      if (regexp.flags) result = `(?${regexp.flags})${result}`;
      return result;
    }
    function parseJSON(bytes) {
      let text;
      try {
        text = decodeUTF8(bytes);
      } catch {
        return JSON_parse(bytes);
      }
      return JSON.parse(text);
    }
    var fs = __require("fs");
    var os = __require("os");
    var path = __require("path");
    var ESBUILD_BINARY_PATH = process.env.ESBUILD_BINARY_PATH || ESBUILD_BINARY_PATH;
    var isValidBinaryPath = (x) => !!x && x !== "/usr/bin/esbuild";
    var packageDarwin_arm64 = "@esbuild/darwin-arm64";
    var packageDarwin_x64 = "@esbuild/darwin-x64";
    var knownWindowsPackages = {
      "win32 arm64 LE": "@esbuild/win32-arm64",
      "win32 ia32 LE": "@esbuild/win32-ia32",
      "win32 x64 LE": "@esbuild/win32-x64"
    };
    var knownUnixlikePackages = {
      "aix ppc64 BE": "@esbuild/aix-ppc64",
      "android arm64 LE": "@esbuild/android-arm64",
      "darwin arm64 LE": "@esbuild/darwin-arm64",
      "darwin x64 LE": "@esbuild/darwin-x64",
      "freebsd arm64 LE": "@esbuild/freebsd-arm64",
      "freebsd x64 LE": "@esbuild/freebsd-x64",
      "linux arm LE": "@esbuild/linux-arm",
      "linux arm64 LE": "@esbuild/linux-arm64",
      "linux ia32 LE": "@esbuild/linux-ia32",
      "linux mips64el LE": "@esbuild/linux-mips64el",
      "linux ppc64 LE": "@esbuild/linux-ppc64",
      "linux riscv64 LE": "@esbuild/linux-riscv64",
      "linux s390x BE": "@esbuild/linux-s390x",
      "linux x64 LE": "@esbuild/linux-x64",
      "linux loong64 LE": "@esbuild/linux-loong64",
      "netbsd arm64 LE": "@esbuild/netbsd-arm64",
      "netbsd x64 LE": "@esbuild/netbsd-x64",
      "openbsd arm64 LE": "@esbuild/openbsd-arm64",
      "openbsd x64 LE": "@esbuild/openbsd-x64",
      "sunos x64 LE": "@esbuild/sunos-x64"
    };
    var knownWebAssemblyFallbackPackages = {
      "android arm LE": "@esbuild/android-arm",
      "android x64 LE": "@esbuild/android-x64",
      "openharmony arm64 LE": "@esbuild/openharmony-arm64"
    };
    function pkgAndSubpathForCurrentPlatform() {
      let pkg;
      let subpath;
      let isWASM = false;
      let platformKey = `${process.platform} ${os.arch()} ${os.endianness()}`;
      if (platformKey in knownWindowsPackages) {
        pkg = knownWindowsPackages[platformKey];
        subpath = "esbuild.exe";
      } else if (platformKey in knownUnixlikePackages) {
        pkg = knownUnixlikePackages[platformKey];
        subpath = "bin/esbuild";
      } else if (platformKey in knownWebAssemblyFallbackPackages) {
        pkg = knownWebAssemblyFallbackPackages[platformKey];
        subpath = "bin/esbuild";
        isWASM = true;
      } else {
        throw new Error(`Unsupported platform: ${platformKey}`);
      }
      return { pkg, subpath, isWASM };
    }
    function pkgForSomeOtherPlatform() {
      const libMainJS = __require.resolve("esbuild");
      const nodeModulesDirectory = path.dirname(path.dirname(path.dirname(libMainJS)));
      if (path.basename(nodeModulesDirectory) === "node_modules") {
        for (const unixKey in knownUnixlikePackages) {
          try {
            const pkg = knownUnixlikePackages[unixKey];
            if (fs.existsSync(path.join(nodeModulesDirectory, pkg))) return pkg;
          } catch {
          }
        }
        for (const windowsKey in knownWindowsPackages) {
          try {
            const pkg = knownWindowsPackages[windowsKey];
            if (fs.existsSync(path.join(nodeModulesDirectory, pkg))) return pkg;
          } catch {
          }
        }
      }
      return null;
    }
    function downloadedBinPath(pkg, subpath) {
      const esbuildLibDir = path.dirname(__require.resolve("esbuild"));
      return path.join(esbuildLibDir, `downloaded-${pkg.replace("/", "-")}-${path.basename(subpath)}`);
    }
    function generateBinPath() {
      if (isValidBinaryPath(ESBUILD_BINARY_PATH)) {
        if (!fs.existsSync(ESBUILD_BINARY_PATH)) {
          console.warn(`[esbuild] Ignoring bad configuration: ESBUILD_BINARY_PATH=${ESBUILD_BINARY_PATH}`);
        } else {
          return { binPath: ESBUILD_BINARY_PATH, isWASM: false };
        }
      }
      const { pkg, subpath, isWASM } = pkgAndSubpathForCurrentPlatform();
      let binPath;
      try {
        binPath = __require.resolve(`${pkg}/${subpath}`);
      } catch (e5) {
        binPath = downloadedBinPath(pkg, subpath);
        if (!fs.existsSync(binPath)) {
          try {
            __require.resolve(pkg);
          } catch {
            const otherPkg = pkgForSomeOtherPlatform();
            if (otherPkg) {
              let suggestions = `
Specifically the "${otherPkg}" package is present but this platform
needs the "${pkg}" package instead. People often get into this
situation by installing esbuild on Windows or macOS and copying "node_modules"
into a Docker image that runs Linux, or by copying "node_modules" between
Windows and WSL environments.

If you are installing with npm, you can try not copying the "node_modules"
directory when you copy the files over, and running "npm ci" or "npm install"
on the destination platform after the copy. Or you could consider using yarn
instead of npm which has built-in support for installing a package on multiple
platforms simultaneously.

If you are installing with yarn, you can try listing both this platform and the
other platform in your ".yarnrc.yml" file using the "supportedArchitectures"
feature: https://yarnpkg.com/configuration/yarnrc/#supportedArchitectures
Keep in mind that this means multiple copies of esbuild will be present.
`;
              if (pkg === packageDarwin_x64 && otherPkg === packageDarwin_arm64 || pkg === packageDarwin_arm64 && otherPkg === packageDarwin_x64) {
                suggestions = `
Specifically the "${otherPkg}" package is present but this platform
needs the "${pkg}" package instead. People often get into this
situation by installing esbuild with npm running inside of Rosetta 2 and then
trying to use it with node running outside of Rosetta 2, or vice versa (Rosetta
2 is Apple's on-the-fly x86_64-to-arm64 translation service).

If you are installing with npm, you can try ensuring that both npm and node are
not running under Rosetta 2 and then reinstalling esbuild. This likely involves
changing how you installed npm and/or node. For example, installing node with
the universal installer here should work: https://nodejs.org/en/download/. Or
you could consider using yarn instead of npm which has built-in support for
installing a package on multiple platforms simultaneously.

If you are installing with yarn, you can try listing both "arm64" and "x64"
in your ".yarnrc.yml" file using the "supportedArchitectures" feature:
https://yarnpkg.com/configuration/yarnrc/#supportedArchitectures
Keep in mind that this means multiple copies of esbuild will be present.
`;
              }
              throw new Error(`
You installed esbuild for another platform than the one you're currently using.
This won't work because esbuild is written with native code and needs to
install a platform-specific binary executable.
${suggestions}
Another alternative is to use the "esbuild-wasm" package instead, which works
the same way on all platforms. But it comes with a heavy performance cost and
can sometimes be 10x slower than the "esbuild" package, so you may also not
want to do that.
`);
            }
            throw new Error(`The package "${pkg}" could not be found, and is needed by esbuild.

If you are installing esbuild with npm, make sure that you don't specify the
"--no-optional" or "--omit=optional" flags. The "optionalDependencies" feature
of "package.json" is used by esbuild to install the correct binary executable
for your current platform.`);
          }
          throw e5;
        }
      }
      if (/\.zip\//.test(binPath)) {
        let pnpapi;
        try {
          pnpapi = __require("pnpapi");
        } catch (e5) {
        }
        if (pnpapi) {
          const root = pnpapi.getPackageInformation(pnpapi.topLevel).packageLocation;
          const binTargetPath = path.join(
            root,
            "node_modules",
            ".cache",
            "esbuild",
            `pnpapi-${pkg.replace("/", "-")}-${"0.27.4"}-${path.basename(subpath)}`
          );
          if (!fs.existsSync(binTargetPath)) {
            fs.mkdirSync(path.dirname(binTargetPath), { recursive: true });
            fs.copyFileSync(binPath, binTargetPath);
            fs.chmodSync(binTargetPath, 493);
          }
          return { binPath: binTargetPath, isWASM };
        }
      }
      return { binPath, isWASM };
    }
    var child_process = __require("child_process");
    var crypto = __require("crypto");
    var path2 = __require("path");
    var fs2 = __require("fs");
    var os2 = __require("os");
    var tty = __require("tty");
    var worker_threads;
    if (process.env.ESBUILD_WORKER_THREADS !== "0") {
      try {
        worker_threads = __require("worker_threads");
      } catch {
      }
      let [major, minor] = process.versions.node.split(".");
      if (
        // <v12.17.0 does not work
        +major < 12 || +major === 12 && +minor < 17 || +major === 13 && +minor < 13
      ) {
        worker_threads = void 0;
      }
    }
    var _a;
    var isInternalWorkerThread = ((_a = worker_threads == null ? void 0 : worker_threads.workerData) == null ? void 0 : _a.esbuildVersion) === "0.27.4";
    var esbuildCommandAndArgs = () => {
      if ((!ESBUILD_BINARY_PATH || false) && (path2.basename(__filename) !== "main.js" || path2.basename(__dirname) !== "lib")) {
        throw new Error(
          `The esbuild JavaScript API cannot be bundled. Please mark the "esbuild" package as external so it's not included in the bundle.

More information: The file containing the code for esbuild's JavaScript API (${__filename}) does not appear to be inside the esbuild package on the file system, which usually means that the esbuild package was bundled into another file. This is problematic because the API needs to run a binary executable inside the esbuild package which is located using a relative path from the API code to the executable. If the esbuild package is bundled, the relative path will be incorrect and the executable won't be found.`
        );
      }
      if (false) {
        return ["node", [path2.join(__dirname, "..", "bin", "esbuild")]];
      } else {
        const { binPath, isWASM } = generateBinPath();
        if (isWASM) {
          return ["node", [binPath]];
        } else {
          return [binPath, []];
        }
      }
    };
    var isTTY = () => tty.isatty(2);
    var fsSync = {
      readFile(tempFile, callback) {
        try {
          let contents = fs2.readFileSync(tempFile, "utf8");
          try {
            fs2.unlinkSync(tempFile);
          } catch {
          }
          callback(null, contents);
        } catch (err) {
          callback(err, null);
        }
      },
      writeFile(contents, callback) {
        try {
          let tempFile = randomFileName();
          fs2.writeFileSync(tempFile, contents);
          callback(tempFile);
        } catch {
          callback(null);
        }
      }
    };
    var fsAsync = {
      readFile(tempFile, callback) {
        try {
          fs2.readFile(tempFile, "utf8", (err, contents) => {
            try {
              fs2.unlink(tempFile, () => callback(err, contents));
            } catch {
              callback(err, contents);
            }
          });
        } catch (err) {
          callback(err, null);
        }
      },
      writeFile(contents, callback) {
        try {
          let tempFile = randomFileName();
          fs2.writeFile(tempFile, contents, (err) => err !== null ? callback(null) : callback(tempFile));
        } catch {
          callback(null);
        }
      }
    };
    var version = "0.27.4";
    var build = (options) => ensureServiceIsRunning().build(options);
    var context = (buildOptions) => ensureServiceIsRunning().context(buildOptions);
    var transform = (input, options) => ensureServiceIsRunning().transform(input, options);
    var formatMessages = (messages, options) => ensureServiceIsRunning().formatMessages(messages, options);
    var analyzeMetafile = (messages, options) => ensureServiceIsRunning().analyzeMetafile(messages, options);
    var buildSync = (options) => {
      if (worker_threads && !isInternalWorkerThread) {
        if (!workerThreadService) workerThreadService = startWorkerThreadService(worker_threads);
        return workerThreadService.buildSync(options);
      }
      let result;
      runServiceSync((service) => service.buildOrContext({
        callName: "buildSync",
        refs: null,
        options,
        isTTY: isTTY(),
        defaultWD,
        callback: (err, res) => {
          if (err) throw err;
          result = res;
        }
      }));
      return result;
    };
    var transformSync = (input, options) => {
      if (worker_threads && !isInternalWorkerThread) {
        if (!workerThreadService) workerThreadService = startWorkerThreadService(worker_threads);
        return workerThreadService.transformSync(input, options);
      }
      let result;
      runServiceSync((service) => service.transform({
        callName: "transformSync",
        refs: null,
        input,
        options: options || {},
        isTTY: isTTY(),
        fs: fsSync,
        callback: (err, res) => {
          if (err) throw err;
          result = res;
        }
      }));
      return result;
    };
    var formatMessagesSync = (messages, options) => {
      if (worker_threads && !isInternalWorkerThread) {
        if (!workerThreadService) workerThreadService = startWorkerThreadService(worker_threads);
        return workerThreadService.formatMessagesSync(messages, options);
      }
      let result;
      runServiceSync((service) => service.formatMessages({
        callName: "formatMessagesSync",
        refs: null,
        messages,
        options,
        callback: (err, res) => {
          if (err) throw err;
          result = res;
        }
      }));
      return result;
    };
    var analyzeMetafileSync = (metafile, options) => {
      if (worker_threads && !isInternalWorkerThread) {
        if (!workerThreadService) workerThreadService = startWorkerThreadService(worker_threads);
        return workerThreadService.analyzeMetafileSync(metafile, options);
      }
      let result;
      runServiceSync((service) => service.analyzeMetafile({
        callName: "analyzeMetafileSync",
        refs: null,
        metafile: typeof metafile === "string" ? metafile : JSON.stringify(metafile),
        options,
        callback: (err, res) => {
          if (err) throw err;
          result = res;
        }
      }));
      return result;
    };
    var stop = () => {
      if (stopService) stopService();
      if (workerThreadService) workerThreadService.stop();
      return Promise.resolve();
    };
    var initializeWasCalled = false;
    var initialize = (options) => {
      options = validateInitializeOptions(options || {});
      if (options.wasmURL) throw new Error(`The "wasmURL" option only works in the browser`);
      if (options.wasmModule) throw new Error(`The "wasmModule" option only works in the browser`);
      if (options.worker) throw new Error(`The "worker" option only works in the browser`);
      if (initializeWasCalled) throw new Error('Cannot call "initialize" more than once');
      ensureServiceIsRunning();
      initializeWasCalled = true;
      return Promise.resolve();
    };
    var defaultWD = process.cwd();
    var longLivedService;
    var stopService;
    var ensureServiceIsRunning = () => {
      if (longLivedService) return longLivedService;
      let [command, args] = esbuildCommandAndArgs();
      let child = child_process.spawn(command, args.concat(`--service=${"0.27.4"}`, "--ping"), {
        windowsHide: true,
        stdio: ["pipe", "pipe", "inherit"],
        cwd: defaultWD
      });
      let { readFromStdout, afterClose, service } = createChannel({
        writeToStdin(bytes) {
          child.stdin.write(bytes, (err) => {
            if (err) afterClose(err);
          });
        },
        readFileSync: fs2.readFileSync,
        isSync: false,
        hasFS: true,
        esbuild: node_exports
      });
      child.stdin.on("error", afterClose);
      child.on("error", afterClose);
      const stdin = child.stdin;
      const stdout = child.stdout;
      stdout.on("data", readFromStdout);
      stdout.on("end", afterClose);
      stopService = () => {
        stdin.destroy();
        stdout.destroy();
        child.kill();
        initializeWasCalled = false;
        longLivedService = void 0;
        stopService = void 0;
      };
      let refCount = 0;
      child.unref();
      if (stdin.unref) {
        stdin.unref();
      }
      if (stdout.unref) {
        stdout.unref();
      }
      const refs = {
        ref() {
          if (++refCount === 1) child.ref();
        },
        unref() {
          if (--refCount === 0) child.unref();
        }
      };
      longLivedService = {
        build: (options) => new Promise((resolve, reject) => {
          service.buildOrContext({
            callName: "build",
            refs,
            options,
            isTTY: isTTY(),
            defaultWD,
            callback: (err, res) => err ? reject(err) : resolve(res)
          });
        }),
        context: (options) => new Promise((resolve, reject) => service.buildOrContext({
          callName: "context",
          refs,
          options,
          isTTY: isTTY(),
          defaultWD,
          callback: (err, res) => err ? reject(err) : resolve(res)
        })),
        transform: (input, options) => new Promise((resolve, reject) => service.transform({
          callName: "transform",
          refs,
          input,
          options: options || {},
          isTTY: isTTY(),
          fs: fsAsync,
          callback: (err, res) => err ? reject(err) : resolve(res)
        })),
        formatMessages: (messages, options) => new Promise((resolve, reject) => service.formatMessages({
          callName: "formatMessages",
          refs,
          messages,
          options,
          callback: (err, res) => err ? reject(err) : resolve(res)
        })),
        analyzeMetafile: (metafile, options) => new Promise((resolve, reject) => service.analyzeMetafile({
          callName: "analyzeMetafile",
          refs,
          metafile: typeof metafile === "string" ? metafile : JSON.stringify(metafile),
          options,
          callback: (err, res) => err ? reject(err) : resolve(res)
        }))
      };
      return longLivedService;
    };
    var runServiceSync = (callback) => {
      let [command, args] = esbuildCommandAndArgs();
      let stdin = new Uint8Array();
      let { readFromStdout, afterClose, service } = createChannel({
        writeToStdin(bytes) {
          if (stdin.length !== 0) throw new Error("Must run at most one command");
          stdin = bytes;
        },
        isSync: true,
        hasFS: true,
        esbuild: node_exports
      });
      callback(service);
      let stdout = child_process.execFileSync(command, args.concat(`--service=${"0.27.4"}`), {
        cwd: defaultWD,
        windowsHide: true,
        input: stdin,
        // We don't know how large the output could be. If it's too large, the
        // command will fail with ENOBUFS. Reserve 16mb for now since that feels
        // like it should be enough. Also allow overriding this with an environment
        // variable.
        maxBuffer: +process.env.ESBUILD_MAX_BUFFER || 16 * 1024 * 1024
      });
      readFromStdout(stdout);
      afterClose(null);
    };
    var randomFileName = () => {
      return path2.join(os2.tmpdir(), `esbuild-${crypto.randomBytes(32).toString("hex")}`);
    };
    var workerThreadService = null;
    var startWorkerThreadService = (worker_threads2) => {
      let { port1: mainPort, port2: workerPort } = new worker_threads2.MessageChannel();
      let worker = new worker_threads2.Worker(__filename, {
        workerData: { workerPort, defaultWD, esbuildVersion: "0.27.4" },
        transferList: [workerPort],
        // From node's documentation: https://nodejs.org/api/worker_threads.html
        //
        //   Take care when launching worker threads from preload scripts (scripts loaded
        //   and run using the `-r` command line flag). Unless the `execArgv` option is
        //   explicitly set, new Worker threads automatically inherit the command line flags
        //   from the running process and will preload the same preload scripts as the main
        //   thread. If the preload script unconditionally launches a worker thread, every
        //   thread spawned will spawn another until the application crashes.
        //
        execArgv: []
      });
      let nextID = 0;
      let fakeBuildError = (text) => {
        let error = new Error(`Build failed with 1 error:
error: ${text}`);
        let errors = [{ id: "", pluginName: "", text, location: null, notes: [], detail: void 0 }];
        error.errors = errors;
        error.warnings = [];
        return error;
      };
      let validateBuildSyncOptions = (options) => {
        if (!options) return;
        let plugins = options.plugins;
        if (plugins && plugins.length > 0) throw fakeBuildError(`Cannot use plugins in synchronous API calls`);
      };
      let applyProperties = (object, properties) => {
        for (let key in properties) {
          object[key] = properties[key];
        }
      };
      let runCallSync = (command, args) => {
        let id = nextID++;
        let sharedBuffer = new SharedArrayBuffer(8);
        let sharedBufferView = new Int32Array(sharedBuffer);
        let msg = { sharedBuffer, id, command, args };
        worker.postMessage(msg);
        let status = Atomics.wait(sharedBufferView, 0, 0);
        if (status !== "ok" && status !== "not-equal") throw new Error("Internal error: Atomics.wait() failed: " + status);
        let { message: { id: id2, resolve, reject, properties } } = worker_threads2.receiveMessageOnPort(mainPort);
        if (id !== id2) throw new Error(`Internal error: Expected id ${id} but got id ${id2}`);
        if (reject) {
          applyProperties(reject, properties);
          throw reject;
        }
        return resolve;
      };
      worker.unref();
      return {
        buildSync(options) {
          validateBuildSyncOptions(options);
          return runCallSync("build", [options]);
        },
        transformSync(input, options) {
          return runCallSync("transform", [input, options]);
        },
        formatMessagesSync(messages, options) {
          return runCallSync("formatMessages", [messages, options]);
        },
        analyzeMetafileSync(metafile, options) {
          return runCallSync("analyzeMetafile", [metafile, options]);
        },
        stop() {
          worker.terminate();
          workerThreadService = null;
        }
      };
    };
    var startSyncServiceWorker = () => {
      let workerPort = worker_threads.workerData.workerPort;
      let parentPort = worker_threads.parentPort;
      let extractProperties = (object) => {
        let properties = {};
        if (object && typeof object === "object") {
          for (let key in object) {
            properties[key] = object[key];
          }
        }
        return properties;
      };
      try {
        let service = ensureServiceIsRunning();
        defaultWD = worker_threads.workerData.defaultWD;
        parentPort.on("message", (msg) => {
          (async () => {
            let { sharedBuffer, id, command, args } = msg;
            let sharedBufferView = new Int32Array(sharedBuffer);
            try {
              switch (command) {
                case "build":
                  workerPort.postMessage({ id, resolve: await service.build(args[0]) });
                  break;
                case "transform":
                  workerPort.postMessage({ id, resolve: await service.transform(args[0], args[1]) });
                  break;
                case "formatMessages":
                  workerPort.postMessage({ id, resolve: await service.formatMessages(args[0], args[1]) });
                  break;
                case "analyzeMetafile":
                  workerPort.postMessage({ id, resolve: await service.analyzeMetafile(args[0], args[1]) });
                  break;
                default:
                  throw new Error(`Invalid command: ${command}`);
              }
            } catch (reject) {
              workerPort.postMessage({ id, reject, properties: extractProperties(reject) });
            }
            Atomics.add(sharedBufferView, 0, 1);
            Atomics.notify(sharedBufferView, 0, Infinity);
          })();
        });
      } catch (reject) {
        parentPort.on("message", (msg) => {
          let { sharedBuffer, id } = msg;
          let sharedBufferView = new Int32Array(sharedBuffer);
          workerPort.postMessage({ id, reject, properties: extractProperties(reject) });
          Atomics.add(sharedBufferView, 0, 1);
          Atomics.notify(sharedBufferView, 0, Infinity);
        });
      }
    };
    if (isInternalWorkerThread) {
      startSyncServiceWorker();
    }
    var node_default = node_exports;
  }
});

// node_modules/tsx/dist/get-pipe-path-BHW2eJdv.mjs
import { createRequire as o2 } from "module";
import a from "path";

// node_modules/tsx/dist/temporary-directory-CwHp0_NW.mjs
import r from "path";
import o from "os";
var { geteuid: t } = process;
var s = t ? t() : o.userInfo().username;
var e = r.join(o.tmpdir(), `tsx-${s}`);

// node_modules/tsx/dist/get-pipe-path-BHW2eJdv.mjs
var p = Object.defineProperty;
var e2 = (t3, r2) => p(t3, "name", { value: r2, configurable: true });
var m = o2(import.meta.url);
var i = process.platform === "win32";
var n = e2((t3) => {
  const r2 = a.join(e, `${t3}.pipe`);
  return i ? `\\\\?\\pipe\\${r2}` : r2;
}, "getPipePath");

// node_modules/tsx/dist/register-CFH5oNdT.mjs
import d3 from "module";
import p4 from "path";
import { fileURLToPath as O4 } from "url";

// node_modules/get-tsconfig/dist/index.mjs
import m3 from "path";
import re from "fs";
import he from "module";

// node_modules/resolve-pkg-maps/dist/index.mjs
var A = (r2) => r2 !== null && typeof r2 == "object";
var a2 = (r2, t3) => Object.assign(new Error(`[${r2}]: ${t3}`), { code: r2 });
var _ = "ERR_INVALID_PACKAGE_CONFIG";
var E = "ERR_INVALID_PACKAGE_TARGET";
var I = "ERR_PACKAGE_PATH_NOT_EXPORTED";
var R = /^\d+$/;
var O = /^(\.{1,2}|node_modules)$/i;
var w = /\/|\\/;
var h = ((r2) => (r2.Export = "exports", r2.Import = "imports", r2))(h || {});
var f = (r2, t3, e5, o5, c2) => {
  if (t3 == null) return [];
  if (typeof t3 == "string") {
    const [n2, ...i5] = t3.split(w);
    if (n2 === ".." || i5.some((l2) => O.test(l2))) throw a2(E, `Invalid "${r2}" target "${t3}" defined in the package config`);
    return [c2 ? t3.replace(/\*/g, c2) : t3];
  }
  if (Array.isArray(t3)) return t3.flatMap((n2) => f(r2, n2, e5, o5, c2));
  if (A(t3)) {
    for (const n2 of Object.keys(t3)) {
      if (R.test(n2)) throw a2(_, "Cannot contain numeric property keys");
      if (n2 === "default" || o5.includes(n2)) return f(r2, t3[n2], e5, o5, c2);
    }
    return [];
  }
  throw a2(E, `Invalid "${r2}" target "${t3}"`);
};
var s2 = "*";
var m2 = (r2, t3) => {
  const e5 = r2.indexOf(s2), o5 = t3.indexOf(s2);
  return e5 === o5 ? t3.length > r2.length : o5 > e5;
};
function d(r2, t3) {
  if (!t3.includes(s2) && r2.hasOwnProperty(t3)) return [t3];
  let e5, o5;
  for (const c2 of Object.keys(r2)) if (c2.includes(s2)) {
    const [n2, i5, l2] = c2.split(s2);
    if (l2 === void 0 && t3.startsWith(n2) && t3.endsWith(i5)) {
      const g2 = t3.slice(n2.length, -i5.length || void 0);
      g2 && (!e5 || m2(e5, c2)) && (e5 = c2, o5 = g2);
    }
  }
  return [e5, o5];
}
var p2 = (r2) => Object.keys(r2).reduce((t3, e5) => {
  const o5 = e5 === "" || e5[0] !== ".";
  if (t3 === void 0 || t3 === o5) return o5;
  throw a2(_, '"exports" cannot contain some keys starting with "." and some not');
}, void 0);
var u = /^\w+:/;
var v = (r2, t3, e5) => {
  if (!r2) throw new Error('"exports" is required');
  t3 = t3 === "" ? "." : `./${t3}`, (typeof r2 == "string" || Array.isArray(r2) || A(r2) && p2(r2)) && (r2 = { ".": r2 });
  const [o5, c2] = d(r2, t3), n2 = f(h.Export, r2[o5], t3, e5, c2);
  if (n2.length === 0) throw a2(I, t3 === "." ? 'No "exports" main defined' : `Package subpath '${t3}' is not defined by "exports"`);
  for (const i5 of n2) if (!i5.startsWith("./") && !u.test(i5)) throw a2(E, `Invalid "exports" target "${i5}" defined in the package config`);
  return n2;
};

// node_modules/get-tsconfig/dist/index.mjs
import xe from "fs";
import Be from "os";
import Ie from "path";
var Le = Object.defineProperty;
var i2 = (e5, t3) => Le(e5, "name", { value: t3, configurable: true });
function h2(e5) {
  return e5.startsWith("\\\\?\\") ? e5 : e5.replace(/\\/g, "/");
}
i2(h2, "slash");
var Z = i2((e5) => {
  const t3 = re[e5];
  return (s4, ...n2) => {
    const o5 = `${e5}:${n2.join(":")}`;
    let l2 = s4 == null ? void 0 : s4.get(o5);
    return l2 === void 0 && (l2 = Reflect.apply(t3, re, n2), s4 == null || s4.set(o5, l2)), l2;
  };
}, "cacheFs");
var E2 = Z("existsSync");
var $e = Z("readFileSync");
var G = Z("statSync");
var fe = i2((e5, t3, s4) => {
  for (; ; ) {
    const n2 = m3.posix.join(e5, t3);
    if (E2(s4, n2)) return n2;
    const o5 = m3.dirname(e5);
    if (o5 === e5) return;
    e5 = o5;
  }
}, "findUp");
var q = /^\.{1,2}(\/.*)?$/;
var K = i2((e5) => {
  const t3 = h2(e5);
  return q.test(t3) ? t3 : `./${t3}`;
}, "normalizeRelativePath");
function Ue(e5, t3 = false) {
  const s4 = e5.length;
  let n2 = 0, o5 = "", l2 = 0, u3 = 16, a5 = 0, r2 = 0, g2 = 0, v4 = 0, d4 = 0;
  function _4(c2, y3) {
    let A3 = 0, b3 = 0;
    for (; A3 < c2; ) {
      let k2 = e5.charCodeAt(n2);
      if (k2 >= 48 && k2 <= 57) b3 = b3 * 16 + k2 - 48;
      else if (k2 >= 65 && k2 <= 70) b3 = b3 * 16 + k2 - 65 + 10;
      else if (k2 >= 97 && k2 <= 102) b3 = b3 * 16 + k2 - 97 + 10;
      else break;
      n2++, A3++;
    }
    return A3 < c2 && (b3 = -1), b3;
  }
  i2(_4, "scanHexDigits");
  function p5(c2) {
    n2 = c2, o5 = "", l2 = 0, u3 = 16, d4 = 0;
  }
  i2(p5, "setPosition");
  function D3() {
    let c2 = n2;
    if (e5.charCodeAt(n2) === 48) n2++;
    else for (n2++; n2 < e5.length && N(e5.charCodeAt(n2)); ) n2++;
    if (n2 < e5.length && e5.charCodeAt(n2) === 46) if (n2++, n2 < e5.length && N(e5.charCodeAt(n2))) for (n2++; n2 < e5.length && N(e5.charCodeAt(n2)); ) n2++;
    else return d4 = 3, e5.substring(c2, n2);
    let y3 = n2;
    if (n2 < e5.length && (e5.charCodeAt(n2) === 69 || e5.charCodeAt(n2) === 101)) if (n2++, (n2 < e5.length && e5.charCodeAt(n2) === 43 || e5.charCodeAt(n2) === 45) && n2++, n2 < e5.length && N(e5.charCodeAt(n2))) {
      for (n2++; n2 < e5.length && N(e5.charCodeAt(n2)); ) n2++;
      y3 = n2;
    } else d4 = 3;
    return e5.substring(c2, y3);
  }
  i2(D3, "scanNumber");
  function L2() {
    let c2 = "", y3 = n2;
    for (; ; ) {
      if (n2 >= s4) {
        c2 += e5.substring(y3, n2), d4 = 2;
        break;
      }
      const A3 = e5.charCodeAt(n2);
      if (A3 === 34) {
        c2 += e5.substring(y3, n2), n2++;
        break;
      }
      if (A3 === 92) {
        if (c2 += e5.substring(y3, n2), n2++, n2 >= s4) {
          d4 = 2;
          break;
        }
        switch (e5.charCodeAt(n2++)) {
          case 34:
            c2 += '"';
            break;
          case 92:
            c2 += "\\";
            break;
          case 47:
            c2 += "/";
            break;
          case 98:
            c2 += "\b";
            break;
          case 102:
            c2 += "\f";
            break;
          case 110:
            c2 += `
`;
            break;
          case 114:
            c2 += "\r";
            break;
          case 116:
            c2 += "	";
            break;
          case 117:
            const k2 = _4(4);
            k2 >= 0 ? c2 += String.fromCharCode(k2) : d4 = 4;
            break;
          default:
            d4 = 5;
        }
        y3 = n2;
        continue;
      }
      if (A3 >= 0 && A3 <= 31) if (J(A3)) {
        c2 += e5.substring(y3, n2), d4 = 2;
        break;
      } else d4 = 6;
      n2++;
    }
    return c2;
  }
  i2(L2, "scanString");
  function T3() {
    if (o5 = "", d4 = 0, l2 = n2, r2 = a5, v4 = g2, n2 >= s4) return l2 = s4, u3 = 17;
    let c2 = e5.charCodeAt(n2);
    if (O2(c2)) {
      do
        n2++, o5 += String.fromCharCode(c2), c2 = e5.charCodeAt(n2);
      while (O2(c2));
      return u3 = 15;
    }
    if (J(c2)) return n2++, o5 += String.fromCharCode(c2), c2 === 13 && e5.charCodeAt(n2) === 10 && (n2++, o5 += `
`), a5++, g2 = n2, u3 = 14;
    switch (c2) {
      case 123:
        return n2++, u3 = 1;
      case 125:
        return n2++, u3 = 2;
      case 91:
        return n2++, u3 = 3;
      case 93:
        return n2++, u3 = 4;
      case 58:
        return n2++, u3 = 6;
      case 44:
        return n2++, u3 = 5;
      case 34:
        return n2++, o5 = L2(), u3 = 10;
      case 47:
        const y3 = n2 - 1;
        if (e5.charCodeAt(n2 + 1) === 47) {
          for (n2 += 2; n2 < s4 && !J(e5.charCodeAt(n2)); ) n2++;
          return o5 = e5.substring(y3, n2), u3 = 12;
        }
        if (e5.charCodeAt(n2 + 1) === 42) {
          n2 += 2;
          const A3 = s4 - 1;
          let b3 = false;
          for (; n2 < A3; ) {
            const k2 = e5.charCodeAt(n2);
            if (k2 === 42 && e5.charCodeAt(n2 + 1) === 47) {
              n2 += 2, b3 = true;
              break;
            }
            n2++, J(k2) && (k2 === 13 && e5.charCodeAt(n2) === 10 && n2++, a5++, g2 = n2);
          }
          return b3 || (n2++, d4 = 1), o5 = e5.substring(y3, n2), u3 = 13;
        }
        return o5 += String.fromCharCode(c2), n2++, u3 = 16;
      case 45:
        if (o5 += String.fromCharCode(c2), n2++, n2 === s4 || !N(e5.charCodeAt(n2))) return u3 = 16;
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        return o5 += D3(), u3 = 11;
      default:
        for (; n2 < s4 && F3(c2); ) n2++, c2 = e5.charCodeAt(n2);
        if (l2 !== n2) {
          switch (o5 = e5.substring(l2, n2), o5) {
            case "true":
              return u3 = 8;
            case "false":
              return u3 = 9;
            case "null":
              return u3 = 7;
          }
          return u3 = 16;
        }
        return o5 += String.fromCharCode(c2), n2++, u3 = 16;
    }
  }
  i2(T3, "scanNext");
  function F3(c2) {
    if (O2(c2) || J(c2)) return false;
    switch (c2) {
      case 125:
      case 93:
      case 123:
      case 91:
      case 34:
      case 58:
      case 44:
      case 47:
        return false;
    }
    return true;
  }
  i2(F3, "isUnknownContentCharacter");
  function x() {
    let c2;
    do
      c2 = T3();
    while (c2 >= 12 && c2 <= 15);
    return c2;
  }
  return i2(x, "scanNextNonTrivia"), { setPosition: p5, getPosition: i2(() => n2, "getPosition"), scan: t3 ? x : T3, getToken: i2(() => u3, "getToken"), getTokenValue: i2(() => o5, "getTokenValue"), getTokenOffset: i2(() => l2, "getTokenOffset"), getTokenLength: i2(() => n2 - l2, "getTokenLength"), getTokenStartLine: i2(() => r2, "getTokenStartLine"), getTokenStartCharacter: i2(() => l2 - v4, "getTokenStartCharacter"), getTokenError: i2(() => d4, "getTokenError") };
}
i2(Ue, "createScanner");
function O2(e5) {
  return e5 === 32 || e5 === 9;
}
i2(O2, "isWhiteSpace");
function J(e5) {
  return e5 === 10 || e5 === 13;
}
i2(J, "isLineBreak");
function N(e5) {
  return e5 >= 48 && e5 <= 57;
}
i2(N, "isDigit");
var ae;
(function(e5) {
  e5[e5.lineFeed = 10] = "lineFeed", e5[e5.carriageReturn = 13] = "carriageReturn", e5[e5.space = 32] = "space", e5[e5._0 = 48] = "_0", e5[e5._1 = 49] = "_1", e5[e5._2 = 50] = "_2", e5[e5._3 = 51] = "_3", e5[e5._4 = 52] = "_4", e5[e5._5 = 53] = "_5", e5[e5._6 = 54] = "_6", e5[e5._7 = 55] = "_7", e5[e5._8 = 56] = "_8", e5[e5._9 = 57] = "_9", e5[e5.a = 97] = "a", e5[e5.b = 98] = "b", e5[e5.c = 99] = "c", e5[e5.d = 100] = "d", e5[e5.e = 101] = "e", e5[e5.f = 102] = "f", e5[e5.g = 103] = "g", e5[e5.h = 104] = "h", e5[e5.i = 105] = "i", e5[e5.j = 106] = "j", e5[e5.k = 107] = "k", e5[e5.l = 108] = "l", e5[e5.m = 109] = "m", e5[e5.n = 110] = "n", e5[e5.o = 111] = "o", e5[e5.p = 112] = "p", e5[e5.q = 113] = "q", e5[e5.r = 114] = "r", e5[e5.s = 115] = "s", e5[e5.t = 116] = "t", e5[e5.u = 117] = "u", e5[e5.v = 118] = "v", e5[e5.w = 119] = "w", e5[e5.x = 120] = "x", e5[e5.y = 121] = "y", e5[e5.z = 122] = "z", e5[e5.A = 65] = "A", e5[e5.B = 66] = "B", e5[e5.C = 67] = "C", e5[e5.D = 68] = "D", e5[e5.E = 69] = "E", e5[e5.F = 70] = "F", e5[e5.G = 71] = "G", e5[e5.H = 72] = "H", e5[e5.I = 73] = "I", e5[e5.J = 74] = "J", e5[e5.K = 75] = "K", e5[e5.L = 76] = "L", e5[e5.M = 77] = "M", e5[e5.N = 78] = "N", e5[e5.O = 79] = "O", e5[e5.P = 80] = "P", e5[e5.Q = 81] = "Q", e5[e5.R = 82] = "R", e5[e5.S = 83] = "S", e5[e5.T = 84] = "T", e5[e5.U = 85] = "U", e5[e5.V = 86] = "V", e5[e5.W = 87] = "W", e5[e5.X = 88] = "X", e5[e5.Y = 89] = "Y", e5[e5.Z = 90] = "Z", e5[e5.asterisk = 42] = "asterisk", e5[e5.backslash = 92] = "backslash", e5[e5.closeBrace = 125] = "closeBrace", e5[e5.closeBracket = 93] = "closeBracket", e5[e5.colon = 58] = "colon", e5[e5.comma = 44] = "comma", e5[e5.dot = 46] = "dot", e5[e5.doubleQuote = 34] = "doubleQuote", e5[e5.minus = 45] = "minus", e5[e5.openBrace = 123] = "openBrace", e5[e5.openBracket = 91] = "openBracket", e5[e5.plus = 43] = "plus", e5[e5.slash = 47] = "slash", e5[e5.formFeed = 12] = "formFeed", e5[e5.tab = 9] = "tab";
})(ae || (ae = {})), new Array(20).fill(0).map((e5, t3) => " ".repeat(t3));
var P = 200;
new Array(P).fill(0).map((e5, t3) => `
` + " ".repeat(t3)), new Array(P).fill(0).map((e5, t3) => "\r" + " ".repeat(t3)), new Array(P).fill(0).map((e5, t3) => `\r
` + " ".repeat(t3)), new Array(P).fill(0).map((e5, t3) => `
` + "	".repeat(t3)), new Array(P).fill(0).map((e5, t3) => "\r" + "	".repeat(t3)), new Array(P).fill(0).map((e5, t3) => `\r
` + "	".repeat(t3));
var Q;
(function(e5) {
  e5.DEFAULT = { allowTrailingComma: false };
})(Q || (Q = {}));
function Ne(e5, t3 = [], s4 = Q.DEFAULT) {
  let n2 = null, o5 = [];
  const l2 = [];
  function u3(r2) {
    Array.isArray(o5) ? o5.push(r2) : n2 !== null && (o5[n2] = r2);
  }
  return i2(u3, "onValue"), Pe(e5, { onObjectBegin: i2(() => {
    const r2 = {};
    u3(r2), l2.push(o5), o5 = r2, n2 = null;
  }, "onObjectBegin"), onObjectProperty: i2((r2) => {
    n2 = r2;
  }, "onObjectProperty"), onObjectEnd: i2(() => {
    o5 = l2.pop();
  }, "onObjectEnd"), onArrayBegin: i2(() => {
    const r2 = [];
    u3(r2), l2.push(o5), o5 = r2, n2 = null;
  }, "onArrayBegin"), onArrayEnd: i2(() => {
    o5 = l2.pop();
  }, "onArrayEnd"), onLiteralValue: u3, onError: i2((r2, g2, v4) => {
    t3.push({ error: r2, offset: g2, length: v4 });
  }, "onError") }, s4), o5[0];
}
i2(Ne, "parse$1");
function Pe(e5, t3, s4 = Q.DEFAULT) {
  const n2 = Ue(e5, false), o5 = [];
  let l2 = 0;
  function u3(w3) {
    return w3 ? () => l2 === 0 && w3(n2.getTokenOffset(), n2.getTokenLength(), n2.getTokenStartLine(), n2.getTokenStartCharacter()) : () => true;
  }
  i2(u3, "toNoArgVisit");
  function a5(w3) {
    return w3 ? (j2) => l2 === 0 && w3(j2, n2.getTokenOffset(), n2.getTokenLength(), n2.getTokenStartLine(), n2.getTokenStartCharacter()) : () => true;
  }
  i2(a5, "toOneArgVisit");
  function r2(w3) {
    return w3 ? (j2) => l2 === 0 && w3(j2, n2.getTokenOffset(), n2.getTokenLength(), n2.getTokenStartLine(), n2.getTokenStartCharacter(), () => o5.slice()) : () => true;
  }
  i2(r2, "toOneArgVisitWithPath");
  function g2(w3) {
    return w3 ? () => {
      l2 > 0 ? l2++ : w3(n2.getTokenOffset(), n2.getTokenLength(), n2.getTokenStartLine(), n2.getTokenStartCharacter(), () => o5.slice()) === false && (l2 = 1);
    } : () => true;
  }
  i2(g2, "toBeginVisit");
  function v4(w3) {
    return w3 ? () => {
      l2 > 0 && l2--, l2 === 0 && w3(n2.getTokenOffset(), n2.getTokenLength(), n2.getTokenStartLine(), n2.getTokenStartCharacter());
    } : () => true;
  }
  i2(v4, "toEndVisit");
  const d4 = g2(t3.onObjectBegin), _4 = r2(t3.onObjectProperty), p5 = v4(t3.onObjectEnd), D3 = g2(t3.onArrayBegin), L2 = v4(t3.onArrayEnd), T3 = r2(t3.onLiteralValue), F3 = a5(t3.onSeparator), x = u3(t3.onComment), c2 = a5(t3.onError), y3 = s4 && s4.disallowComments, A3 = s4 && s4.allowTrailingComma;
  function b3() {
    for (; ; ) {
      const w3 = n2.scan();
      switch (n2.getTokenError()) {
        case 4:
          k2(14);
          break;
        case 5:
          k2(15);
          break;
        case 3:
          k2(13);
          break;
        case 1:
          y3 || k2(11);
          break;
        case 2:
          k2(12);
          break;
        case 6:
          k2(16);
          break;
      }
      switch (w3) {
        case 12:
        case 13:
          y3 ? k2(10) : x();
          break;
        case 16:
          k2(1);
          break;
        case 15:
        case 14:
          break;
        default:
          return w3;
      }
    }
  }
  i2(b3, "scanNext");
  function k2(w3, j2 = [], S2 = []) {
    if (c2(w3), j2.length + S2.length > 0) {
      let $2 = n2.getToken();
      for (; $2 !== 17; ) {
        if (j2.indexOf($2) !== -1) {
          b3();
          break;
        } else if (S2.indexOf($2) !== -1) break;
        $2 = b3();
      }
    }
  }
  i2(k2, "handleError");
  function R4(w3) {
    const j2 = n2.getTokenValue();
    return w3 ? T3(j2) : (_4(j2), o5.push(j2)), b3(), true;
  }
  i2(R4, "parseString");
  function W() {
    switch (n2.getToken()) {
      case 11:
        const w3 = n2.getTokenValue();
        let j2 = Number(w3);
        isNaN(j2) && (k2(2), j2 = 0), T3(j2);
        break;
      case 7:
        T3(null);
        break;
      case 8:
        T3(true);
        break;
      case 9:
        T3(false);
        break;
      default:
        return false;
    }
    return b3(), true;
  }
  i2(W, "parseLiteral");
  function V2() {
    return n2.getToken() !== 10 ? (k2(3, [], [2, 5]), false) : (R4(false), n2.getToken() === 6 ? (F3(":"), b3(), U2() || k2(4, [], [2, 5])) : k2(5, [], [2, 5]), o5.pop(), true);
  }
  i2(V2, "parseProperty");
  function M2() {
    d4(), b3();
    let w3 = false;
    for (; n2.getToken() !== 2 && n2.getToken() !== 17; ) {
      if (n2.getToken() === 5) {
        if (w3 || k2(4, [], []), F3(","), b3(), n2.getToken() === 2 && A3) break;
      } else w3 && k2(6, [], []);
      V2() || k2(4, [], [2, 5]), w3 = true;
    }
    return p5(), n2.getToken() !== 2 ? k2(7, [2], []) : b3(), true;
  }
  i2(M2, "parseObject");
  function z2() {
    D3(), b3();
    let w3 = true, j2 = false;
    for (; n2.getToken() !== 4 && n2.getToken() !== 17; ) {
      if (n2.getToken() === 5) {
        if (j2 || k2(4, [], []), F3(","), b3(), n2.getToken() === 4 && A3) break;
      } else j2 && k2(6, [], []);
      w3 ? (o5.push(0), w3 = false) : o5[o5.length - 1]++, U2() || k2(4, [], [4, 5]), j2 = true;
    }
    return L2(), w3 || o5.pop(), n2.getToken() !== 4 ? k2(8, [4], []) : b3(), true;
  }
  i2(z2, "parseArray");
  function U2() {
    switch (n2.getToken()) {
      case 3:
        return z2();
      case 1:
        return M2();
      case 10:
        return R4(true);
      default:
        return W();
    }
  }
  return i2(U2, "parseValue"), b3(), n2.getToken() === 17 ? s4.allowEmptyContent ? true : (k2(4, [], []), false) : U2() ? (n2.getToken() !== 17 && k2(9, [], []), true) : (k2(4, [], []), false);
}
i2(Pe, "visit");
var ce;
(function(e5) {
  e5[e5.None = 0] = "None", e5[e5.UnexpectedEndOfComment = 1] = "UnexpectedEndOfComment", e5[e5.UnexpectedEndOfString = 2] = "UnexpectedEndOfString", e5[e5.UnexpectedEndOfNumber = 3] = "UnexpectedEndOfNumber", e5[e5.InvalidUnicode = 4] = "InvalidUnicode", e5[e5.InvalidEscapeCharacter = 5] = "InvalidEscapeCharacter", e5[e5.InvalidCharacter = 6] = "InvalidCharacter";
})(ce || (ce = {}));
var ge;
(function(e5) {
  e5[e5.OpenBraceToken = 1] = "OpenBraceToken", e5[e5.CloseBraceToken = 2] = "CloseBraceToken", e5[e5.OpenBracketToken = 3] = "OpenBracketToken", e5[e5.CloseBracketToken = 4] = "CloseBracketToken", e5[e5.CommaToken = 5] = "CommaToken", e5[e5.ColonToken = 6] = "ColonToken", e5[e5.NullKeyword = 7] = "NullKeyword", e5[e5.TrueKeyword = 8] = "TrueKeyword", e5[e5.FalseKeyword = 9] = "FalseKeyword", e5[e5.StringLiteral = 10] = "StringLiteral", e5[e5.NumericLiteral = 11] = "NumericLiteral", e5[e5.LineCommentTrivia = 12] = "LineCommentTrivia", e5[e5.BlockCommentTrivia = 13] = "BlockCommentTrivia", e5[e5.LineBreakTrivia = 14] = "LineBreakTrivia", e5[e5.Trivia = 15] = "Trivia", e5[e5.Unknown = 16] = "Unknown", e5[e5.EOF = 17] = "EOF";
})(ge || (ge = {}));
var Re = Ne;
var ke;
(function(e5) {
  e5[e5.InvalidSymbol = 1] = "InvalidSymbol", e5[e5.InvalidNumberFormat = 2] = "InvalidNumberFormat", e5[e5.PropertyNameExpected = 3] = "PropertyNameExpected", e5[e5.ValueExpected = 4] = "ValueExpected", e5[e5.ColonExpected = 5] = "ColonExpected", e5[e5.CommaExpected = 6] = "CommaExpected", e5[e5.CloseBraceExpected = 7] = "CloseBraceExpected", e5[e5.CloseBracketExpected = 8] = "CloseBracketExpected", e5[e5.EndOfFileExpected = 9] = "EndOfFileExpected", e5[e5.InvalidCommentToken = 10] = "InvalidCommentToken", e5[e5.UnexpectedEndOfComment = 11] = "UnexpectedEndOfComment", e5[e5.UnexpectedEndOfString = 12] = "UnexpectedEndOfString", e5[e5.UnexpectedEndOfNumber = 13] = "UnexpectedEndOfNumber", e5[e5.InvalidUnicode = 14] = "InvalidUnicode", e5[e5.InvalidEscapeCharacter = 15] = "InvalidEscapeCharacter", e5[e5.InvalidCharacter = 16] = "InvalidCharacter";
})(ke || (ke = {}));
var me = i2((e5, t3) => Re($e(t3, e5, "utf8")), "readJsonc");
var C = /* @__PURE__ */ Symbol("implicitBaseUrl");
var I2 = "${configDir}";
var Se = i2(() => {
  const { findPnpApi: e5 } = he;
  return e5 && e5(process.cwd());
}, "getPnpApi");
var ee = i2((e5, t3, s4, n2) => {
  const o5 = `resolveFromPackageJsonPath:${e5}:${t3}:${s4}`;
  if (n2 != null && n2.has(o5)) return n2.get(o5);
  const l2 = me(e5, n2);
  if (!l2) return;
  let u3 = t3 || "tsconfig.json";
  if (!s4 && l2.exports) try {
    const [a5] = v(l2.exports, t3, ["require", "types"]);
    u3 = a5;
  } catch {
    return false;
  }
  else !t3 && l2.tsconfig && (u3 = l2.tsconfig);
  return u3 = m3.join(e5, "..", u3), n2 == null || n2.set(o5, u3), u3;
}, "resolveFromPackageJsonPath");
var ne = "package.json";
var te = "tsconfig.json";
var Je = i2((e5, t3, s4) => {
  let n2 = e5;
  if (e5 === ".." && (n2 = m3.join(n2, te)), e5[0] === "." && (n2 = m3.resolve(t3, n2)), m3.isAbsolute(n2)) {
    if (E2(s4, n2)) {
      if (G(s4, n2).isFile()) return n2;
    } else if (!n2.endsWith(".json")) {
      const p5 = `${n2}.json`;
      if (E2(s4, p5)) return p5;
    }
    return;
  }
  const [o5, ...l2] = e5.split("/"), u3 = o5[0] === "@" ? `${o5}/${l2.shift()}` : o5, a5 = l2.join("/"), r2 = Se();
  if (r2) {
    const { resolveRequest: p5 } = r2;
    try {
      if (u3 === e5) {
        const D3 = p5(m3.join(u3, ne), t3);
        if (D3) {
          const L2 = ee(D3, a5, false, s4);
          if (L2 && E2(s4, L2)) return L2;
        }
      } else {
        let D3;
        try {
          D3 = p5(e5, t3, { extensions: [".json"] });
        } catch {
          D3 = p5(m3.join(e5, te), t3);
        }
        if (D3) return D3;
      }
    } catch {
    }
  }
  const g2 = fe(m3.resolve(t3), m3.join("node_modules", u3), s4);
  if (!g2 || !G(s4, g2).isDirectory()) return;
  const v4 = m3.join(g2, ne);
  if (E2(s4, v4)) {
    const p5 = ee(v4, a5, false, s4);
    if (p5 === false) return;
    if (p5 && E2(s4, p5) && G(s4, p5).isFile()) return p5;
  }
  const d4 = m3.join(g2, a5), _4 = d4.endsWith(".json");
  if (!_4) {
    const p5 = `${d4}.json`;
    if (E2(s4, p5)) return p5;
  }
  if (E2(s4, d4)) {
    if (G(s4, d4).isDirectory()) {
      const p5 = m3.join(d4, ne);
      if (E2(s4, p5)) {
        const L2 = ee(p5, "", true, s4);
        if (L2 && E2(s4, L2)) return L2;
      }
      const D3 = m3.join(d4, te);
      if (E2(s4, D3)) return D3;
    } else if (_4) return d4;
  }
}, "resolveExtendsPath");
var se = i2((e5, t3) => K(m3.relative(e5, t3)), "pathRelative");
var we = ["files", "include", "exclude"];
var de = i2((e5, t3, s4) => {
  const n2 = m3.join(t3, s4), o5 = m3.relative(e5, n2);
  return h2(o5) || "./";
}, "resolveAndRelativize");
var We = i2((e5, t3, s4) => {
  const n2 = m3.relative(e5, t3);
  if (!n2) return s4;
  const o5 = s4.startsWith("./") ? s4.slice(2) : s4;
  return h2(`${n2}/${o5}`);
}, "prefixPattern");
var Ve = i2((e5, t3, s4, n2) => {
  const o5 = Je(e5, t3, n2);
  if (!o5) throw new Error(`File '${e5}' not found.`);
  if (s4.has(o5)) throw new Error(`Circularity detected while resolving configuration: ${o5}`);
  s4.add(o5);
  const l2 = m3.dirname(o5), u3 = ve(o5, n2, s4);
  delete u3.references;
  const { compilerOptions: a5 } = u3;
  if (a5) {
    const { baseUrl: r2 } = a5;
    r2 && !r2.startsWith(I2) && (a5.baseUrl = de(t3, l2, r2));
    const { outDir: g2 } = a5;
    g2 && !g2.startsWith(I2) && (a5.outDir = de(t3, l2, g2));
  }
  for (const r2 of we) {
    const g2 = u3[r2];
    g2 && (u3[r2] = g2.map((v4) => v4.startsWith(I2) ? v4 : We(t3, l2, v4)));
  }
  return u3;
}, "resolveExtends");
var be = ["outDir", "declarationDir"];
var ve = i2((e5, t3, s4 = /* @__PURE__ */ new Set()) => {
  let n2;
  try {
    n2 = me(e5, t3) || {};
  } catch {
    throw new Error(`Cannot resolve tsconfig at path: ${e5}`);
  }
  if (typeof n2 != "object") throw new SyntaxError(`Failed to parse tsconfig at: ${e5}`);
  const o5 = m3.dirname(e5);
  if (n2.compilerOptions) {
    const { compilerOptions: l2 } = n2;
    l2.paths && !l2.baseUrl && (l2[C] = o5);
  }
  if (n2.extends) {
    const l2 = Array.isArray(n2.extends) ? n2.extends : [n2.extends];
    delete n2.extends;
    for (const u3 of l2.reverse()) {
      const a5 = Ve(u3, o5, new Set(s4), t3), r2 = { ...a5, ...n2, compilerOptions: { ...a5.compilerOptions, ...n2.compilerOptions } };
      a5.watchOptions && (r2.watchOptions = { ...a5.watchOptions, ...n2.watchOptions }), n2 = r2;
    }
  }
  if (n2.compilerOptions) {
    const { compilerOptions: l2 } = n2, u3 = ["baseUrl", "rootDir"];
    for (const a5 of u3) {
      const r2 = l2[a5];
      if (r2 && !r2.startsWith(I2)) {
        const g2 = m3.resolve(o5, r2), v4 = se(o5, g2);
        l2[a5] = v4;
      }
    }
    for (const a5 of be) {
      let r2 = l2[a5];
      r2 && (Array.isArray(n2.exclude) || (n2.exclude = be.map((g2) => l2[g2]).filter(Boolean)), r2.startsWith(I2) || (r2 = K(r2)), l2[a5] = r2);
    }
  } else n2.compilerOptions = {};
  if (n2.include ? (n2.include = n2.include.map(h2), n2.files && delete n2.files) : n2.files && (n2.files = n2.files.map((l2) => l2.startsWith(I2) ? l2 : K(l2))), n2.watchOptions) {
    const { watchOptions: l2 } = n2;
    l2.excludeDirectories && (l2.excludeDirectories = l2.excludeDirectories.map((u3) => h2(m3.resolve(o5, u3)))), l2.excludeFiles && (l2.excludeFiles = l2.excludeFiles.map((u3) => h2(m3.resolve(o5, u3)))), l2.watchFile && (l2.watchFile = l2.watchFile.toLowerCase()), l2.watchDirectory && (l2.watchDirectory = l2.watchDirectory.toLowerCase()), l2.fallbackPolling && (l2.fallbackPolling = l2.fallbackPolling.toLowerCase());
  }
  return n2;
}, "_parseTsconfig");
var H = i2((e5, t3) => {
  if (e5.startsWith(I2)) return h2(m3.join(t3, e5.slice(I2.length)));
}, "interpolateConfigDir");
var Me = ["outDir", "declarationDir", "outFile", "rootDir", "baseUrl", "tsBuildInfoFile"];
var ze = i2((e5) => {
  var t3, s4, n2, o5, l2, u3, a5, r2, g2, v4, d4, _4, p5, D3, L2, T3, F3, x, c2, y3, A3, b3, k2, R4, W, V2, M2, z2, U2, w3, j2, S2, $2;
  if (e5.strict) {
    const f5 = ["noImplicitAny", "noImplicitThis", "strictNullChecks", "strictFunctionTypes", "strictBindCallApply", "strictPropertyInitialization", "strictBuiltinIteratorReturn", "alwaysStrict", "useUnknownInCatchVariables"];
    for (const B2 of f5) e5[B2] === void 0 && (e5[B2] = true);
  }
  if (e5.composite && ((t3 = e5.declaration) != null || (e5.declaration = true), (s4 = e5.incremental) != null || (e5.incremental = true)), e5.target) {
    let f5 = e5.target.toLowerCase();
    f5 === "es2015" && (f5 = "es6"), e5.target = f5, f5 === "esnext" && ((n2 = e5.module) != null || (e5.module = "es6"), (o5 = e5.useDefineForClassFields) != null || (e5.useDefineForClassFields = true)), (f5 === "es6" || f5 === "es2016" || f5 === "es2017" || f5 === "es2018" || f5 === "es2019" || f5 === "es2020" || f5 === "es2021" || f5 === "es2022" || f5 === "es2023" || f5 === "es2024") && ((l2 = e5.module) != null || (e5.module = "es6")), (f5 === "es2022" || f5 === "es2023" || f5 === "es2024") && ((u3 = e5.useDefineForClassFields) != null || (e5.useDefineForClassFields = true));
  }
  if (e5.module) {
    let f5 = e5.module.toLowerCase();
    if (f5 === "es2015" && (f5 = "es6"), e5.module = f5, (f5 === "es6" || f5 === "es2020" || f5 === "es2022" || f5 === "esnext" || f5 === "none" || f5 === "system" || f5 === "umd" || f5 === "amd") && ((a5 = e5.moduleResolution) != null || (e5.moduleResolution = "classic")), f5 === "system" && ((r2 = e5.allowSyntheticDefaultImports) != null || (e5.allowSyntheticDefaultImports = true)), (f5 === "node16" || f5 === "node18" || f5 === "node20" || f5 === "nodenext" || f5 === "preserve") && ((g2 = e5.esModuleInterop) != null || (e5.esModuleInterop = true), (v4 = e5.allowSyntheticDefaultImports) != null || (e5.allowSyntheticDefaultImports = true)), (f5 === "node16" || f5 === "node18" || f5 === "node20" || f5 === "nodenext") && ((d4 = e5.moduleDetection) != null || (e5.moduleDetection = "force")), f5 === "node16" && ((_4 = e5.target) != null || (e5.target = "es2022"), (p5 = e5.moduleResolution) != null || (e5.moduleResolution = "node16")), f5 === "node18" && ((D3 = e5.target) != null || (e5.target = "es2022"), (L2 = e5.moduleResolution) != null || (e5.moduleResolution = "node16")), f5 === "node20" && ((T3 = e5.target) != null || (e5.target = "es2023"), (F3 = e5.moduleResolution) != null || (e5.moduleResolution = "node16"), (x = e5.resolveJsonModule) != null || (e5.resolveJsonModule = true)), f5 === "nodenext" && ((c2 = e5.target) != null || (e5.target = "esnext"), (y3 = e5.moduleResolution) != null || (e5.moduleResolution = "nodenext"), (A3 = e5.resolveJsonModule) != null || (e5.resolveJsonModule = true)), f5 === "node16" || f5 === "node18" || f5 === "node20" || f5 === "nodenext") {
      const B2 = e5.target;
      (B2 === "es3" || B2 === "es2022" || B2 === "es2023" || B2 === "es2024" || B2 === "esnext") && ((b3 = e5.useDefineForClassFields) != null || (e5.useDefineForClassFields = true));
    }
    f5 === "preserve" && ((k2 = e5.moduleResolution) != null || (e5.moduleResolution = "bundler"));
  }
  if (e5.moduleResolution) {
    let f5 = e5.moduleResolution.toLowerCase();
    f5 === "node" && (f5 = "node10"), e5.moduleResolution = f5, (f5 === "node16" || f5 === "nodenext" || f5 === "bundler") && ((R4 = e5.resolvePackageJsonExports) != null || (e5.resolvePackageJsonExports = true), (W = e5.resolvePackageJsonImports) != null || (e5.resolvePackageJsonImports = true)), f5 === "bundler" && ((V2 = e5.allowSyntheticDefaultImports) != null || (e5.allowSyntheticDefaultImports = true), (M2 = e5.resolveJsonModule) != null || (e5.resolveJsonModule = true));
  }
  e5.jsx && (e5.jsx = e5.jsx.toLowerCase()), e5.moduleDetection && (e5.moduleDetection = e5.moduleDetection.toLowerCase()), e5.importsNotUsedAsValues && (e5.importsNotUsedAsValues = e5.importsNotUsedAsValues.toLowerCase()), e5.newLine && (e5.newLine = e5.newLine.toLowerCase()), e5.esModuleInterop && ((z2 = e5.allowSyntheticDefaultImports) != null || (e5.allowSyntheticDefaultImports = true)), e5.verbatimModuleSyntax && ((U2 = e5.isolatedModules) != null || (e5.isolatedModules = true), (w3 = e5.preserveConstEnums) != null || (e5.preserveConstEnums = true)), e5.isolatedModules && ((j2 = e5.preserveConstEnums) != null || (e5.preserveConstEnums = true)), e5.rewriteRelativeImportExtensions && ((S2 = e5.allowImportingTsExtensions) != null || (e5.allowImportingTsExtensions = true)), e5.lib && (e5.lib = e5.lib.map((f5) => f5.toLowerCase())), e5.checkJs && (($2 = e5.allowJs) != null || (e5.allowJs = true));
}, "normalizeCompilerOptions");
var pe = i2((e5, t3 = /* @__PURE__ */ new Map()) => {
  const s4 = m3.resolve(e5), n2 = ve(s4, t3), o5 = m3.dirname(s4), { compilerOptions: l2 } = n2;
  if (l2) {
    for (const a5 of Me) {
      const r2 = l2[a5];
      if (r2) {
        const g2 = H(r2, o5);
        l2[a5] = g2 ? se(o5, g2) : r2;
      }
    }
    for (const a5 of ["rootDirs", "typeRoots"]) {
      const r2 = l2[a5];
      r2 && (l2[a5] = r2.map((g2) => {
        const v4 = H(g2, o5);
        return v4 ? se(o5, v4) : g2;
      }));
    }
    const { paths: u3 } = l2;
    if (u3) for (const a5 of Object.keys(u3)) u3[a5] = u3[a5].map((r2) => {
      var g2;
      return (g2 = H(r2, o5)) != null ? g2 : r2;
    });
    ze(l2);
  }
  for (const u3 of we) {
    const a5 = n2[u3];
    a5 && (n2[u3] = a5.map((r2) => {
      var g2;
      return (g2 = H(r2, o5)) != null ? g2 : r2;
    }));
  }
  return n2;
}, "parseTsconfig");
var Ge = i2((e5 = process.cwd(), t3 = "tsconfig.json", s4 = /* @__PURE__ */ new Map()) => {
  const n2 = fe(h2(e5), t3, s4);
  if (!n2) return null;
  const o5 = pe(n2, s4);
  return { path: n2, config: o5 };
}, "getTsconfig");
var Qe = /\*/g;
var Te = i2((e5, t3) => {
  const s4 = e5.match(Qe);
  if (s4 && s4.length > 1) throw new Error(t3);
}, "assertStarCount");
var He = i2((e5) => {
  if (e5.includes("*")) {
    const [t3, s4] = e5.split("*");
    return { prefix: t3, suffix: s4 };
  }
  return e5;
}, "parsePattern");
var Xe = i2(({ prefix: e5, suffix: t3 }, s4) => s4.startsWith(e5) && s4.endsWith(t3), "isPatternMatch");
var Ye = i2((e5, t3, s4) => Object.entries(e5).map(([n2, o5]) => (Te(n2, `Pattern '${n2}' can have at most one '*' character.`), { pattern: He(n2), substitutions: o5.map((l2) => {
  if (Te(l2, `Substitution '${l2}' in pattern '${n2}' can have at most one '*' character.`), !t3 && !q.test(l2) && !m3.isAbsolute(l2)) throw new Error("Non-relative paths are not allowed when 'baseUrl' is not set. Did you forget a leading './'?");
  return m3.resolve(s4, l2);
}) })), "parsePaths");
var Ze = i2((e5) => {
  const { compilerOptions: t3 } = e5.config;
  if (!t3) return null;
  const { baseUrl: s4, paths: n2 } = t3;
  if (!s4 && !n2) return null;
  const o5 = C in t3 && t3[C], l2 = m3.resolve(m3.dirname(e5.path), s4 || o5 || "."), u3 = n2 ? Ye(n2, s4, l2) : [];
  return (a5) => {
    if (q.test(a5)) return [];
    const r2 = [];
    for (const _4 of u3) {
      if (_4.pattern === a5) return _4.substitutions.map(h2);
      typeof _4.pattern != "string" && r2.push(_4);
    }
    let g2, v4 = -1;
    for (const _4 of r2) Xe(_4.pattern, a5) && _4.pattern.prefix.length > v4 && (v4 = _4.pattern.prefix.length, g2 = _4);
    if (!g2) return s4 ? [h2(m3.join(l2, a5))] : [];
    const d4 = a5.slice(g2.pattern.prefix.length, a5.length - g2.pattern.suffix.length);
    return g2.substitutions.map((_4) => h2(_4.replace("*", d4)));
  };
}, "createPathsMatcher");
var qe = Object.defineProperty;
var X = i2((e5, t3) => qe(e5, "name", { value: t3, configurable: true }), "s");
var Ae = X((e5) => {
  let t3 = "";
  for (let s4 = 0; s4 < e5.length; s4 += 1) {
    const n2 = e5[s4], o5 = n2.toUpperCase();
    t3 += n2 === o5 ? n2.toLowerCase() : o5;
  }
  return t3;
}, "invertCase");
var le = /* @__PURE__ */ new Map();
var _e = X((e5, t3) => {
  const s4 = Ie.join(e5, `.is-fs-case-sensitive-test-${process.pid}`);
  try {
    return t3.writeFileSync(s4, ""), !t3.existsSync(Ae(s4));
  } finally {
    try {
      t3.unlinkSync(s4);
    } catch {
    }
  }
}, "checkDirectoryCaseWithWrite");
var Ke = X((e5, t3, s4) => {
  try {
    return _e(e5, s4);
  } catch (n2) {
    if (t3 === void 0) return _e(Be.tmpdir(), s4);
    throw n2;
  }
}, "checkDirectoryCaseWithFallback");
var Oe = X((e5, t3 = xe, s4 = true) => {
  const n2 = e5 != null ? e5 : process.cwd();
  if (s4 && le.has(n2)) return le.get(n2);
  let o5;
  const l2 = Ae(n2);
  return l2 !== n2 && t3.existsSync(n2) ? o5 = !t3.existsSync(l2) : o5 = Ke(n2, e5, t3), s4 && le.set(n2, o5), o5;
}, "isFsCaseSensitive");
var { join: ye } = m3.posix;
var oe = { ts: [".ts", ".tsx", ".d.ts"], cts: [".cts", ".d.cts"], mts: [".mts", ".d.mts"] };
var Ce = i2((e5) => {
  const t3 = [...oe.ts], s4 = [...oe.cts], n2 = [...oe.mts];
  return e5 != null && e5.allowJs && (t3.push(".js", ".jsx"), s4.push(".cjs"), n2.push(".mjs")), [...t3, ...s4, ...n2];
}, "getSupportedExtensions");
var en = i2((e5) => {
  const t3 = [];
  if (!e5) return t3;
  const { outDir: s4, declarationDir: n2 } = e5;
  return s4 && t3.push(s4), n2 && t3.push(n2), t3;
}, "getDefaultExcludeSpec");
var je = i2((e5) => e5.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`), "escapeForRegexp");
var nn = ["node_modules", "bower_components", "jspm_packages"];
var ie = `(?!(${nn.join("|")})(/|$))`;
var tn = /(?:^|\/)[^.*?]+$/;
var Fe = "**/*";
var Y = "[^/]";
var ue = "[^./]";
var De = process.platform === "win32";
var sn = i2(({ config: e5, path: t3 }, s4 = Oe()) => {
  if ("extends" in e5) throw new Error("tsconfig#extends must be resolved. Use getTsconfig or parseTsconfig to resolve it.");
  if (!m3.isAbsolute(t3)) throw new Error("The tsconfig path must be absolute");
  De && (t3 = h2(t3));
  const n2 = m3.dirname(t3), { files: o5, include: l2, exclude: u3, compilerOptions: a5 } = e5, r2 = i2((T3) => m3.isAbsolute(T3) ? T3 : ye(n2, T3), "resolvePattern"), g2 = o5 == null ? void 0 : o5.map(r2), v4 = Ce(a5), d4 = s4 ? "" : "i", p5 = (u3 || en(a5)).map((T3) => {
    const F3 = r2(T3), x = je(F3).replaceAll(String.raw`\*\*/`, "(.+/)?").replaceAll(String.raw`\*`, `${Y}*`).replaceAll(String.raw`\?`, Y);
    return new RegExp(`^${x}($|/)`, d4);
  }), D3 = o5 || l2 ? l2 : [Fe], L2 = D3 ? D3.map((T3) => {
    let F3 = r2(T3);
    tn.test(F3) && (F3 = ye(F3, Fe));
    const x = je(F3).replaceAll(String.raw`/\*\*`, `(/${ie}${ue}${Y}*)*?`).replaceAll(/(\/)?\\\*/g, (c2, y3) => {
      const A3 = `(${ue}|(\\.(?!min\\.js$))?)*`;
      return y3 ? `/${ie}${ue}${A3}` : A3;
    }).replaceAll(/(\/)?\\\?/g, (c2, y3) => {
      const A3 = Y;
      return y3 ? `/${ie}${A3}` : A3;
    });
    return new RegExp(`^${x}$`, d4);
  }) : void 0;
  return (T3) => {
    if (!m3.isAbsolute(T3)) throw new Error("filePath must be absolute");
    if (De && (T3 = h2(T3)), g2 != null && g2.includes(T3)) return e5;
    if (!(!v4.some((F3) => T3.endsWith(F3)) || p5.some((F3) => F3.test(T3))) && L2 && L2.some((F3) => F3.test(T3))) return e5;
  };
}, "createFilesMatcher");

// node_modules/tsx/dist/register-CFH5oNdT.mjs
import se3, { writeSync as te2 } from "fs";

// node_modules/tsx/dist/index-7AaEi15b.mjs
var import_esbuild = __toESM(require_main(), 1);
import { fileURLToPath as Jt, pathToFileURL as Gt } from "url";
import Ht from "crypto";
import U from "fs";
import X2 from "path";
import Xt from "os";
var Pt = Object.defineProperty;
var f2 = (s4, e5) => Pt(s4, "name", { value: e5, configurable: true });
var Ne2 = f2((s4) => Ht.createHash("sha1").update(s4).digest("hex"), "sha1");
var Ie2 = 44;
var Yt = 59;
var Me2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var $e2 = new Uint8Array(64);
var Ue2 = new Uint8Array(128);
for (let s4 = 0; s4 < Me2.length; s4++) {
  const e5 = Me2.charCodeAt(s4);
  $e2[s4] = e5, Ue2[e5] = s4;
}
var me2 = typeof TextDecoder < "u" ? new TextDecoder() : typeof Buffer < "u" ? { decode(s4) {
  return Buffer.from(s4.buffer, s4.byteOffset, s4.byteLength).toString();
} } : { decode(s4) {
  let e5 = "";
  for (let n2 = 0; n2 < s4.length; n2++) e5 += String.fromCharCode(s4[n2]);
  return e5;
} };
function Qt(s4) {
  const e5 = new Int32Array(5), n2 = [];
  let i5 = 0;
  do {
    const o5 = Zt(s4, i5), c2 = [];
    let u3 = true, p5 = 0;
    e5[0] = 0;
    for (let g2 = i5; g2 < o5; g2++) {
      let b3;
      g2 = K2(s4, g2, e5, 0);
      const d4 = e5[0];
      d4 < p5 && (u3 = false), p5 = d4, je2(s4, g2, o5) ? (g2 = K2(s4, g2, e5, 1), g2 = K2(s4, g2, e5, 2), g2 = K2(s4, g2, e5, 3), je2(s4, g2, o5) ? (g2 = K2(s4, g2, e5, 4), b3 = [d4, e5[1], e5[2], e5[3], e5[4]]) : b3 = [d4, e5[1], e5[2], e5[3]]) : b3 = [d4], c2.push(b3);
    }
    u3 || Vt(c2), n2.push(c2), i5 = o5 + 1;
  } while (i5 <= s4.length);
  return n2;
}
f2(Qt, "decode");
function Zt(s4, e5) {
  const n2 = s4.indexOf(";", e5);
  return n2 === -1 ? s4.length : n2;
}
f2(Zt, "indexOf");
function K2(s4, e5, n2, i5) {
  let o5 = 0, c2 = 0, u3 = 0;
  do {
    const g2 = s4.charCodeAt(e5++);
    u3 = Ue2[g2], o5 |= (u3 & 31) << c2, c2 += 5;
  } while (u3 & 32);
  const p5 = o5 & 1;
  return o5 >>>= 1, p5 && (o5 = -2147483648 | -o5), n2[i5] += o5, e5;
}
f2(K2, "decodeInteger");
function je2(s4, e5, n2) {
  return e5 >= n2 ? false : s4.charCodeAt(e5) !== Ie2;
}
f2(je2, "hasMoreVlq");
function Vt(s4) {
  s4.sort(en2);
}
f2(Vt, "sort");
function en2(s4, e5) {
  return s4[0] - e5[0];
}
f2(en2, "sortComparator$1");
function De2(s4) {
  const e5 = new Int32Array(5), n2 = 1024 * 16, i5 = n2 - 36, o5 = new Uint8Array(n2), c2 = o5.subarray(0, i5);
  let u3 = 0, p5 = "";
  for (let g2 = 0; g2 < s4.length; g2++) {
    const b3 = s4[g2];
    if (g2 > 0 && (u3 === n2 && (p5 += me2.decode(o5), u3 = 0), o5[u3++] = Yt), b3.length !== 0) {
      e5[0] = 0;
      for (let d4 = 0; d4 < b3.length; d4++) {
        const r2 = b3[d4];
        u3 > i5 && (p5 += me2.decode(c2), o5.copyWithin(0, i5, u3), u3 -= i5), d4 > 0 && (o5[u3++] = Ie2), u3 = Y2(o5, u3, e5, r2, 0), r2.length !== 1 && (u3 = Y2(o5, u3, e5, r2, 1), u3 = Y2(o5, u3, e5, r2, 2), u3 = Y2(o5, u3, e5, r2, 3), r2.length !== 4 && (u3 = Y2(o5, u3, e5, r2, 4)));
      }
    }
  }
  return p5 + me2.decode(o5.subarray(0, u3));
}
f2(De2, "encode");
function Y2(s4, e5, n2, i5, o5) {
  const c2 = i5[o5];
  let u3 = c2 - n2[o5];
  n2[o5] = c2, u3 = u3 < 0 ? -u3 << 1 | 1 : u3 << 1;
  do {
    let p5 = u3 & 31;
    u3 >>>= 5, u3 > 0 && (p5 |= 32), s4[e5++] = $e2[p5];
  } while (u3 > 0);
  return e5;
}
f2(Y2, "encodeInteger");
var ae2 = class _ae {
  static {
    f2(this, "BitSet");
  }
  constructor(e5) {
    this.bits = e5 instanceof _ae ? e5.bits.slice() : [];
  }
  add(e5) {
    this.bits[e5 >> 5] |= 1 << (e5 & 31);
  }
  has(e5) {
    return !!(this.bits[e5 >> 5] & 1 << (e5 & 31));
  }
};
var ee2 = class _ee {
  static {
    f2(this, "Chunk");
  }
  constructor(e5, n2, i5) {
    this.start = e5, this.end = n2, this.original = i5, this.intro = "", this.outro = "", this.content = i5, this.storeName = false, this.edited = false, this.previous = null, this.next = null;
  }
  appendLeft(e5) {
    this.outro += e5;
  }
  appendRight(e5) {
    this.intro = this.intro + e5;
  }
  clone() {
    const e5 = new _ee(this.start, this.end, this.original);
    return e5.intro = this.intro, e5.outro = this.outro, e5.content = this.content, e5.storeName = this.storeName, e5.edited = this.edited, e5;
  }
  contains(e5) {
    return this.start < e5 && e5 < this.end;
  }
  eachNext(e5) {
    let n2 = this;
    for (; n2; ) e5(n2), n2 = n2.next;
  }
  eachPrevious(e5) {
    let n2 = this;
    for (; n2; ) e5(n2), n2 = n2.previous;
  }
  edit(e5, n2, i5) {
    return this.content = e5, i5 || (this.intro = "", this.outro = ""), this.storeName = n2, this.edited = true, this;
  }
  prependLeft(e5) {
    this.outro = e5 + this.outro;
  }
  prependRight(e5) {
    this.intro = e5 + this.intro;
  }
  reset() {
    this.intro = "", this.outro = "", this.edited && (this.content = this.original, this.storeName = false, this.edited = false);
  }
  split(e5) {
    const n2 = e5 - this.start, i5 = this.original.slice(0, n2), o5 = this.original.slice(n2);
    this.original = i5;
    const c2 = new _ee(e5, this.end, o5);
    return c2.outro = this.outro, this.outro = "", this.end = e5, this.edited ? (c2.edit("", false), this.content = "") : this.content = i5, c2.next = this.next, c2.next && (c2.next.previous = c2), c2.previous = this, this.next = c2, c2;
  }
  toString() {
    return this.intro + this.content + this.outro;
  }
  trimEnd(e5) {
    if (this.outro = this.outro.replace(e5, ""), this.outro.length) return true;
    const n2 = this.content.replace(e5, "");
    if (n2.length) return n2 !== this.content && (this.split(this.start + n2.length).edit("", void 0, true), this.edited && this.edit(n2, this.storeName, true)), true;
    if (this.edit("", void 0, true), this.intro = this.intro.replace(e5, ""), this.intro.length) return true;
  }
  trimStart(e5) {
    if (this.intro = this.intro.replace(e5, ""), this.intro.length) return true;
    const n2 = this.content.replace(e5, "");
    if (n2.length) {
      if (n2 !== this.content) {
        const i5 = this.split(this.end - n2.length);
        this.edited && i5.edit(n2, this.storeName, true), this.edit("", void 0, true);
      }
      return true;
    } else if (this.edit("", void 0, true), this.outro = this.outro.replace(e5, ""), this.outro.length) return true;
  }
};
function tn2() {
  return typeof globalThis < "u" && typeof globalThis.btoa == "function" ? (s4) => globalThis.btoa(unescape(encodeURIComponent(s4))) : typeof Buffer == "function" ? (s4) => Buffer.from(s4, "utf-8").toString("base64") : () => {
    throw new Error("Unsupported environment: `window.btoa` or `Buffer` should be supported.");
  };
}
f2(tn2, "getBtoa");
var nn2 = tn2();
var rn = class {
  static {
    f2(this, "SourceMap");
  }
  constructor(e5) {
    this.version = 3, this.file = e5.file, this.sources = e5.sources, this.sourcesContent = e5.sourcesContent, this.names = e5.names, this.mappings = De2(e5.mappings), typeof e5.x_google_ignoreList < "u" && (this.x_google_ignoreList = e5.x_google_ignoreList);
  }
  toString() {
    return JSON.stringify(this);
  }
  toUrl() {
    return "data:application/json;charset=utf-8;base64," + nn2(this.toString());
  }
};
function sn2(s4) {
  const e5 = s4.split(`
`), n2 = e5.filter((c2) => /^\t+/.test(c2)), i5 = e5.filter((c2) => /^ {2,}/.test(c2));
  if (n2.length === 0 && i5.length === 0) return null;
  if (n2.length >= i5.length) return "	";
  const o5 = i5.reduce((c2, u3) => {
    const p5 = /^ +/.exec(u3)[0].length;
    return Math.min(p5, c2);
  }, 1 / 0);
  return new Array(o5 + 1).join(" ");
}
f2(sn2, "guessIndent");
function on(s4, e5) {
  const n2 = s4.split(/[/\\]/), i5 = e5.split(/[/\\]/);
  for (n2.pop(); n2[0] === i5[0]; ) n2.shift(), i5.shift();
  if (n2.length) {
    let o5 = n2.length;
    for (; o5--; ) n2[o5] = "..";
  }
  return n2.concat(i5).join("/");
}
f2(on, "getRelativePath");
var an = Object.prototype.toString;
function cn(s4) {
  return an.call(s4) === "[object Object]";
}
f2(cn, "isObject");
function Te2(s4) {
  const e5 = s4.split(`
`), n2 = [];
  for (let i5 = 0, o5 = 0; i5 < e5.length; i5++) n2.push(o5), o5 += e5[i5].length + 1;
  return f2(function(o5) {
    let c2 = 0, u3 = n2.length;
    for (; c2 < u3; ) {
      const b3 = c2 + u3 >> 1;
      o5 < n2[b3] ? u3 = b3 : c2 = b3 + 1;
    }
    const p5 = c2 - 1, g2 = o5 - n2[p5];
    return { line: p5, column: g2 };
  }, "locate");
}
f2(Te2, "getLocator");
var un = /\w/;
var ln = class {
  static {
    f2(this, "Mappings");
  }
  constructor(e5) {
    this.hires = e5, this.generatedCodeLine = 0, this.generatedCodeColumn = 0, this.raw = [], this.rawSegments = this.raw[this.generatedCodeLine] = [], this.pending = null;
  }
  addEdit(e5, n2, i5, o5) {
    if (n2.length) {
      const c2 = n2.length - 1;
      let u3 = n2.indexOf(`
`, 0), p5 = -1;
      for (; u3 >= 0 && c2 > u3; ) {
        const b3 = [this.generatedCodeColumn, e5, i5.line, i5.column];
        o5 >= 0 && b3.push(o5), this.rawSegments.push(b3), this.generatedCodeLine += 1, this.raw[this.generatedCodeLine] = this.rawSegments = [], this.generatedCodeColumn = 0, p5 = u3, u3 = n2.indexOf(`
`, u3 + 1);
      }
      const g2 = [this.generatedCodeColumn, e5, i5.line, i5.column];
      o5 >= 0 && g2.push(o5), this.rawSegments.push(g2), this.advance(n2.slice(p5 + 1));
    } else this.pending && (this.rawSegments.push(this.pending), this.advance(n2));
    this.pending = null;
  }
  addUneditedChunk(e5, n2, i5, o5, c2) {
    let u3 = n2.start, p5 = true, g2 = false;
    for (; u3 < n2.end; ) {
      if (this.hires || p5 || c2.has(u3)) {
        const b3 = [this.generatedCodeColumn, e5, o5.line, o5.column];
        this.hires === "boundary" ? un.test(i5[u3]) ? g2 || (this.rawSegments.push(b3), g2 = true) : (this.rawSegments.push(b3), g2 = false) : this.rawSegments.push(b3);
      }
      i5[u3] === `
` ? (o5.line += 1, o5.column = 0, this.generatedCodeLine += 1, this.raw[this.generatedCodeLine] = this.rawSegments = [], this.generatedCodeColumn = 0, p5 = true) : (o5.column += 1, this.generatedCodeColumn += 1, p5 = false), u3 += 1;
    }
    this.pending = null;
  }
  advance(e5) {
    if (!e5) return;
    const n2 = e5.split(`
`);
    if (n2.length > 1) {
      for (let i5 = 0; i5 < n2.length - 1; i5++) this.generatedCodeLine++, this.raw[this.generatedCodeLine] = this.rawSegments = [];
      this.generatedCodeColumn = 0;
    }
    this.generatedCodeColumn += n2[n2.length - 1].length;
  }
};
var Q2 = `
`;
var J2 = { insertLeft: false, insertRight: false, storeName: false };
var _e2 = class __e {
  static {
    f2(this, "MagicString");
  }
  constructor(e5, n2 = {}) {
    const i5 = new ee2(0, e5.length, e5);
    Object.defineProperties(this, { original: { writable: true, value: e5 }, outro: { writable: true, value: "" }, intro: { writable: true, value: "" }, firstChunk: { writable: true, value: i5 }, lastChunk: { writable: true, value: i5 }, lastSearchedChunk: { writable: true, value: i5 }, byStart: { writable: true, value: {} }, byEnd: { writable: true, value: {} }, filename: { writable: true, value: n2.filename }, indentExclusionRanges: { writable: true, value: n2.indentExclusionRanges }, sourcemapLocations: { writable: true, value: new ae2() }, storedNames: { writable: true, value: {} }, indentStr: { writable: true, value: void 0 }, ignoreList: { writable: true, value: n2.ignoreList } }), this.byStart[0] = i5, this.byEnd[e5.length] = i5;
  }
  addSourcemapLocation(e5) {
    this.sourcemapLocations.add(e5);
  }
  append(e5) {
    if (typeof e5 != "string") throw new TypeError("outro content must be a string");
    return this.outro += e5, this;
  }
  appendLeft(e5, n2) {
    if (typeof n2 != "string") throw new TypeError("inserted content must be a string");
    this._split(e5);
    const i5 = this.byEnd[e5];
    return i5 ? i5.appendLeft(n2) : this.intro += n2, this;
  }
  appendRight(e5, n2) {
    if (typeof n2 != "string") throw new TypeError("inserted content must be a string");
    this._split(e5);
    const i5 = this.byStart[e5];
    return i5 ? i5.appendRight(n2) : this.outro += n2, this;
  }
  clone() {
    const e5 = new __e(this.original, { filename: this.filename });
    let n2 = this.firstChunk, i5 = e5.firstChunk = e5.lastSearchedChunk = n2.clone();
    for (; n2; ) {
      e5.byStart[i5.start] = i5, e5.byEnd[i5.end] = i5;
      const o5 = n2.next, c2 = o5 && o5.clone();
      c2 && (i5.next = c2, c2.previous = i5, i5 = c2), n2 = o5;
    }
    return e5.lastChunk = i5, this.indentExclusionRanges && (e5.indentExclusionRanges = this.indentExclusionRanges.slice()), e5.sourcemapLocations = new ae2(this.sourcemapLocations), e5.intro = this.intro, e5.outro = this.outro, e5;
  }
  generateDecodedMap(e5) {
    e5 = e5 || {};
    const n2 = 0, i5 = Object.keys(this.storedNames), o5 = new ln(e5.hires), c2 = Te2(this.original);
    return this.intro && o5.advance(this.intro), this.firstChunk.eachNext((u3) => {
      const p5 = c2(u3.start);
      u3.intro.length && o5.advance(u3.intro), u3.edited ? o5.addEdit(n2, u3.content, p5, u3.storeName ? i5.indexOf(u3.original) : -1) : o5.addUneditedChunk(n2, u3, this.original, p5, this.sourcemapLocations), u3.outro.length && o5.advance(u3.outro);
    }), { file: e5.file ? e5.file.split(/[/\\]/).pop() : void 0, sources: [e5.source ? on(e5.file || "", e5.source) : e5.file || ""], sourcesContent: e5.includeContent ? [this.original] : void 0, names: i5, mappings: o5.raw, x_google_ignoreList: this.ignoreList ? [n2] : void 0 };
  }
  generateMap(e5) {
    return new rn(this.generateDecodedMap(e5));
  }
  _ensureindentStr() {
    this.indentStr === void 0 && (this.indentStr = sn2(this.original));
  }
  _getRawIndentString() {
    return this._ensureindentStr(), this.indentStr;
  }
  getIndentString() {
    return this._ensureindentStr(), this.indentStr === null ? "	" : this.indentStr;
  }
  indent(e5, n2) {
    const i5 = /^[^\r\n]/gm;
    if (cn(e5) && (n2 = e5, e5 = void 0), e5 === void 0 && (this._ensureindentStr(), e5 = this.indentStr || "	"), e5 === "") return this;
    n2 = n2 || {};
    const o5 = {};
    n2.exclude && (typeof n2.exclude[0] == "number" ? [n2.exclude] : n2.exclude).forEach((d4) => {
      for (let r2 = d4[0]; r2 < d4[1]; r2 += 1) o5[r2] = true;
    });
    let c2 = n2.indentStart !== false;
    const u3 = f2((b3) => c2 ? `${e5}${b3}` : (c2 = true, b3), "replacer");
    this.intro = this.intro.replace(i5, u3);
    let p5 = 0, g2 = this.firstChunk;
    for (; g2; ) {
      const b3 = g2.end;
      if (g2.edited) o5[p5] || (g2.content = g2.content.replace(i5, u3), g2.content.length && (c2 = g2.content[g2.content.length - 1] === `
`));
      else for (p5 = g2.start; p5 < b3; ) {
        if (!o5[p5]) {
          const d4 = this.original[p5];
          d4 === `
` ? c2 = true : d4 !== "\r" && c2 && (c2 = false, p5 === g2.start || (this._splitChunk(g2, p5), g2 = g2.next), g2.prependRight(e5));
        }
        p5 += 1;
      }
      p5 = g2.end, g2 = g2.next;
    }
    return this.outro = this.outro.replace(i5, u3), this;
  }
  insert() {
    throw new Error("magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)");
  }
  insertLeft(e5, n2) {
    return J2.insertLeft || (console.warn("magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead"), J2.insertLeft = true), this.appendLeft(e5, n2);
  }
  insertRight(e5, n2) {
    return J2.insertRight || (console.warn("magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead"), J2.insertRight = true), this.prependRight(e5, n2);
  }
  move(e5, n2, i5) {
    if (i5 >= e5 && i5 <= n2) throw new Error("Cannot move a selection inside itself");
    this._split(e5), this._split(n2), this._split(i5);
    const o5 = this.byStart[e5], c2 = this.byEnd[n2], u3 = o5.previous, p5 = c2.next, g2 = this.byStart[i5];
    if (!g2 && c2 === this.lastChunk) return this;
    const b3 = g2 ? g2.previous : this.lastChunk;
    return u3 && (u3.next = p5), p5 && (p5.previous = u3), b3 && (b3.next = o5), g2 && (g2.previous = c2), o5.previous || (this.firstChunk = c2.next), c2.next || (this.lastChunk = o5.previous, this.lastChunk.next = null), o5.previous = b3, c2.next = g2 || null, b3 || (this.firstChunk = o5), g2 || (this.lastChunk = c2), this;
  }
  overwrite(e5, n2, i5, o5) {
    return o5 = o5 || {}, this.update(e5, n2, i5, { ...o5, overwrite: !o5.contentOnly });
  }
  update(e5, n2, i5, o5) {
    if (typeof i5 != "string") throw new TypeError("replacement content must be a string");
    for (; e5 < 0; ) e5 += this.original.length;
    for (; n2 < 0; ) n2 += this.original.length;
    if (n2 > this.original.length) throw new Error("end is out of bounds");
    if (e5 === n2) throw new Error("Cannot overwrite a zero-length range \u2013 use appendLeft or prependRight instead");
    this._split(e5), this._split(n2), o5 === true && (J2.storeName || (console.warn("The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string"), J2.storeName = true), o5 = { storeName: true });
    const c2 = o5 !== void 0 ? o5.storeName : false, u3 = o5 !== void 0 ? o5.overwrite : false;
    if (c2) {
      const b3 = this.original.slice(e5, n2);
      Object.defineProperty(this.storedNames, b3, { writable: true, value: true, enumerable: true });
    }
    const p5 = this.byStart[e5], g2 = this.byEnd[n2];
    if (p5) {
      let b3 = p5;
      for (; b3 !== g2; ) {
        if (b3.next !== this.byStart[b3.end]) throw new Error("Cannot overwrite across a split point");
        b3 = b3.next, b3.edit("", false);
      }
      p5.edit(i5, c2, !u3);
    } else {
      const b3 = new ee2(e5, n2, "").edit(i5, c2);
      g2.next = b3, b3.previous = g2;
    }
    return this;
  }
  prepend(e5) {
    if (typeof e5 != "string") throw new TypeError("outro content must be a string");
    return this.intro = e5 + this.intro, this;
  }
  prependLeft(e5, n2) {
    if (typeof n2 != "string") throw new TypeError("inserted content must be a string");
    this._split(e5);
    const i5 = this.byEnd[e5];
    return i5 ? i5.prependLeft(n2) : this.intro = n2 + this.intro, this;
  }
  prependRight(e5, n2) {
    if (typeof n2 != "string") throw new TypeError("inserted content must be a string");
    this._split(e5);
    const i5 = this.byStart[e5];
    return i5 ? i5.prependRight(n2) : this.outro = n2 + this.outro, this;
  }
  remove(e5, n2) {
    for (; e5 < 0; ) e5 += this.original.length;
    for (; n2 < 0; ) n2 += this.original.length;
    if (e5 === n2) return this;
    if (e5 < 0 || n2 > this.original.length) throw new Error("Character is out of bounds");
    if (e5 > n2) throw new Error("end must be greater than start");
    this._split(e5), this._split(n2);
    let i5 = this.byStart[e5];
    for (; i5; ) i5.intro = "", i5.outro = "", i5.edit(""), i5 = n2 > i5.end ? this.byStart[i5.end] : null;
    return this;
  }
  reset(e5, n2) {
    for (; e5 < 0; ) e5 += this.original.length;
    for (; n2 < 0; ) n2 += this.original.length;
    if (e5 === n2) return this;
    if (e5 < 0 || n2 > this.original.length) throw new Error("Character is out of bounds");
    if (e5 > n2) throw new Error("end must be greater than start");
    this._split(e5), this._split(n2);
    let i5 = this.byStart[e5];
    for (; i5; ) i5.reset(), i5 = n2 > i5.end ? this.byStart[i5.end] : null;
    return this;
  }
  lastChar() {
    if (this.outro.length) return this.outro[this.outro.length - 1];
    let e5 = this.lastChunk;
    do {
      if (e5.outro.length) return e5.outro[e5.outro.length - 1];
      if (e5.content.length) return e5.content[e5.content.length - 1];
      if (e5.intro.length) return e5.intro[e5.intro.length - 1];
    } while (e5 = e5.previous);
    return this.intro.length ? this.intro[this.intro.length - 1] : "";
  }
  lastLine() {
    let e5 = this.outro.lastIndexOf(Q2);
    if (e5 !== -1) return this.outro.substr(e5 + 1);
    let n2 = this.outro, i5 = this.lastChunk;
    do {
      if (i5.outro.length > 0) {
        if (e5 = i5.outro.lastIndexOf(Q2), e5 !== -1) return i5.outro.substr(e5 + 1) + n2;
        n2 = i5.outro + n2;
      }
      if (i5.content.length > 0) {
        if (e5 = i5.content.lastIndexOf(Q2), e5 !== -1) return i5.content.substr(e5 + 1) + n2;
        n2 = i5.content + n2;
      }
      if (i5.intro.length > 0) {
        if (e5 = i5.intro.lastIndexOf(Q2), e5 !== -1) return i5.intro.substr(e5 + 1) + n2;
        n2 = i5.intro + n2;
      }
    } while (i5 = i5.previous);
    return e5 = this.intro.lastIndexOf(Q2), e5 !== -1 ? this.intro.substr(e5 + 1) + n2 : this.intro + n2;
  }
  slice(e5 = 0, n2 = this.original.length) {
    for (; e5 < 0; ) e5 += this.original.length;
    for (; n2 < 0; ) n2 += this.original.length;
    let i5 = "", o5 = this.firstChunk;
    for (; o5 && (o5.start > e5 || o5.end <= e5); ) {
      if (o5.start < n2 && o5.end >= n2) return i5;
      o5 = o5.next;
    }
    if (o5 && o5.edited && o5.start !== e5) throw new Error(`Cannot use replaced character ${e5} as slice start anchor.`);
    const c2 = o5;
    for (; o5; ) {
      o5.intro && (c2 !== o5 || o5.start === e5) && (i5 += o5.intro);
      const u3 = o5.start < n2 && o5.end >= n2;
      if (u3 && o5.edited && o5.end !== n2) throw new Error(`Cannot use replaced character ${n2} as slice end anchor.`);
      const p5 = c2 === o5 ? e5 - o5.start : 0, g2 = u3 ? o5.content.length + n2 - o5.end : o5.content.length;
      if (i5 += o5.content.slice(p5, g2), o5.outro && (!u3 || o5.end === n2) && (i5 += o5.outro), u3) break;
      o5 = o5.next;
    }
    return i5;
  }
  snip(e5, n2) {
    const i5 = this.clone();
    return i5.remove(0, e5), i5.remove(n2, i5.original.length), i5;
  }
  _split(e5) {
    if (this.byStart[e5] || this.byEnd[e5]) return;
    let n2 = this.lastSearchedChunk;
    const i5 = e5 > n2.end;
    for (; n2; ) {
      if (n2.contains(e5)) return this._splitChunk(n2, e5);
      n2 = i5 ? this.byStart[n2.end] : this.byEnd[n2.start];
    }
  }
  _splitChunk(e5, n2) {
    if (e5.edited && e5.content.length) {
      const o5 = Te2(this.original)(n2);
      throw new Error(`Cannot split a chunk that has already been edited (${o5.line}:${o5.column} \u2013 "${e5.original}")`);
    }
    const i5 = e5.split(n2);
    return this.byEnd[n2] = e5, this.byStart[n2] = i5, this.byEnd[i5.end] = i5, e5 === this.lastChunk && (this.lastChunk = i5), this.lastSearchedChunk = e5, true;
  }
  toString() {
    let e5 = this.intro, n2 = this.firstChunk;
    for (; n2; ) e5 += n2.toString(), n2 = n2.next;
    return e5 + this.outro;
  }
  isEmpty() {
    let e5 = this.firstChunk;
    do
      if (e5.intro.length && e5.intro.trim() || e5.content.length && e5.content.trim() || e5.outro.length && e5.outro.trim()) return false;
    while (e5 = e5.next);
    return true;
  }
  length() {
    let e5 = this.firstChunk, n2 = 0;
    do
      n2 += e5.intro.length + e5.content.length + e5.outro.length;
    while (e5 = e5.next);
    return n2;
  }
  trimLines() {
    return this.trim("[\\r\\n]");
  }
  trim(e5) {
    return this.trimStart(e5).trimEnd(e5);
  }
  trimEndAborted(e5) {
    const n2 = new RegExp((e5 || "\\s") + "+$");
    if (this.outro = this.outro.replace(n2, ""), this.outro.length) return true;
    let i5 = this.lastChunk;
    do {
      const o5 = i5.end, c2 = i5.trimEnd(n2);
      if (i5.end !== o5 && (this.lastChunk === i5 && (this.lastChunk = i5.next), this.byEnd[i5.end] = i5, this.byStart[i5.next.start] = i5.next, this.byEnd[i5.next.end] = i5.next), c2) return true;
      i5 = i5.previous;
    } while (i5);
    return false;
  }
  trimEnd(e5) {
    return this.trimEndAborted(e5), this;
  }
  trimStartAborted(e5) {
    const n2 = new RegExp("^" + (e5 || "\\s") + "+");
    if (this.intro = this.intro.replace(n2, ""), this.intro.length) return true;
    let i5 = this.firstChunk;
    do {
      const o5 = i5.end, c2 = i5.trimStart(n2);
      if (i5.end !== o5 && (i5 === this.lastChunk && (this.lastChunk = i5.next), this.byEnd[i5.end] = i5, this.byStart[i5.next.start] = i5.next, this.byEnd[i5.next.end] = i5.next), c2) return true;
      i5 = i5.next;
    } while (i5);
    return false;
  }
  trimStart(e5) {
    return this.trimStartAborted(e5), this;
  }
  hasChanged() {
    return this.original !== this.toString();
  }
  _replaceRegexp(e5, n2) {
    function i5(c2, u3) {
      return typeof n2 == "string" ? n2.replace(/\$(\$|&|\d+)/g, (p5, g2) => g2 === "$" ? "$" : g2 === "&" ? c2[0] : +g2 < c2.length ? c2[+g2] : `$${g2}`) : n2(...c2, c2.index, u3, c2.groups);
    }
    f2(i5, "getReplacement");
    function o5(c2, u3) {
      let p5;
      const g2 = [];
      for (; p5 = c2.exec(u3); ) g2.push(p5);
      return g2;
    }
    if (f2(o5, "matchAll"), e5.global) o5(e5, this.original).forEach((u3) => {
      if (u3.index != null) {
        const p5 = i5(u3, this.original);
        p5 !== u3[0] && this.overwrite(u3.index, u3.index + u3[0].length, p5);
      }
    });
    else {
      const c2 = this.original.match(e5);
      if (c2 && c2.index != null) {
        const u3 = i5(c2, this.original);
        u3 !== c2[0] && this.overwrite(c2.index, c2.index + c2[0].length, u3);
      }
    }
    return this;
  }
  _replaceString(e5, n2) {
    const { original: i5 } = this, o5 = i5.indexOf(e5);
    return o5 !== -1 && this.overwrite(o5, o5 + e5.length, n2), this;
  }
  replace(e5, n2) {
    return typeof e5 == "string" ? this._replaceString(e5, n2) : this._replaceRegexp(e5, n2);
  }
  _replaceAllString(e5, n2) {
    const { original: i5 } = this, o5 = e5.length;
    for (let c2 = i5.indexOf(e5); c2 !== -1; c2 = i5.indexOf(e5, c2 + o5)) i5.slice(c2, c2 + o5) !== n2 && this.overwrite(c2, c2 + o5, n2);
    return this;
  }
  replaceAll(e5, n2) {
    if (typeof e5 == "string") return this._replaceAllString(e5, n2);
    if (!e5.global) throw new TypeError("MagicString.prototype.replaceAll called with a non-global RegExp argument");
    return this._replaceRegexp(e5, n2);
  }
};
var v2;
var re2;
var ke2;
var Z2 = 2 << 19;
var Fe2 = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? function(s4, e5) {
  const n2 = s4.length;
  let i5 = 0;
  for (; i5 < n2; ) e5[i5] = s4.charCodeAt(i5++);
} : function(s4, e5) {
  const n2 = s4.length;
  let i5 = 0;
  for (; i5 < n2; ) {
    const o5 = s4.charCodeAt(i5);
    e5[i5++] = (255 & o5) << 8 | o5 >>> 8;
  }
};
var hn = "xportmportlassforetaourceromsyncunctionssertvoyiedelecontininstantybreareturdebuggeawaithrwhileifcatcfinallels";
var _2;
var We2;
var y;
function fn(s4, e5 = "@") {
  _2 = s4, We2 = e5;
  const n2 = 2 * _2.length + (2 << 18);
  if (n2 > Z2 || !v2) {
    for (; n2 > Z2; ) Z2 *= 2;
    re2 = new ArrayBuffer(Z2), Fe2(hn, new Uint16Array(re2, 16, 110)), v2 = (function(u3, p5, g2) {
      var b3 = new u3.Int8Array(g2), d4 = new u3.Int16Array(g2), r2 = new u3.Int32Array(g2), R4 = new u3.Uint8Array(g2), L2 = new u3.Uint16Array(g2), E5 = 1040;
      function N3() {
        var t3 = 0, a5 = 0, h3 = 0, l2 = 0, w3 = 0, m6 = 0, C4 = 0;
        C4 = E5, E5 = E5 + 10240 | 0, b3[804] = 1, b3[803] = 0, d4[399] = 0, d4[400] = 0, r2[69] = r2[2], b3[805] = 0, r2[68] = 0, b3[802] = 0, r2[70] = C4 + 2048, r2[71] = C4, b3[806] = 0, t3 = (r2[3] | 0) + -2 | 0, r2[72] = t3, a5 = t3 + (r2[66] << 1) | 0, r2[73] = a5;
        e: for (; ; ) {
          if (h3 = t3 + 2 | 0, r2[72] = h3, t3 >>> 0 >= a5 >>> 0) {
            l2 = 18;
            break;
          }
          t: do
            switch (d4[h3 >> 1] | 0) {
              case 9:
              case 10:
              case 11:
              case 12:
              case 13:
              case 32:
                break;
              case 101: {
                if (!(d4[400] | 0) && z2(h3) | 0 && !(A3(t3 + 4 | 0, 16, 10) | 0) && ($2(), (b3[804] | 0) == 0)) {
                  l2 = 9;
                  break e;
                } else l2 = 17;
                break;
              }
              case 105: {
                z2(h3) | 0 && !(A3(t3 + 4 | 0, 26, 10) | 0) && W(), l2 = 17;
                break;
              }
              case 59: {
                l2 = 17;
                break;
              }
              case 47:
                switch (d4[t3 + 4 >> 1] | 0) {
                  case 47: {
                    fe2();
                    break t;
                  }
                  case 42: {
                    le2(1);
                    break t;
                  }
                  default: {
                    l2 = 16;
                    break e;
                  }
                }
              default: {
                l2 = 16;
                break e;
              }
            }
          while (false);
          (l2 | 0) == 17 && (l2 = 0, r2[69] = r2[72]), t3 = r2[72] | 0, a5 = r2[73] | 0;
        }
        (l2 | 0) == 9 ? (t3 = r2[72] | 0, r2[69] = t3, l2 = 19) : (l2 | 0) == 16 ? (b3[804] = 0, r2[72] = t3, l2 = 19) : (l2 | 0) == 18 && (b3[802] | 0 ? t3 = 0 : (t3 = h3, l2 = 19));
        do
          if ((l2 | 0) == 19) {
            e: for (; ; ) {
              if (a5 = t3 + 2 | 0, r2[72] = a5, t3 >>> 0 >= (r2[73] | 0) >>> 0) {
                l2 = 92;
                break;
              }
              t: do
                switch (d4[a5 >> 1] | 0) {
                  case 9:
                  case 10:
                  case 11:
                  case 12:
                  case 13:
                  case 32:
                    break;
                  case 101: {
                    !(d4[400] | 0) && z2(a5) | 0 && !(A3(t3 + 4 | 0, 16, 10) | 0) && $2(), l2 = 91;
                    break;
                  }
                  case 105: {
                    z2(a5) | 0 && !(A3(t3 + 4 | 0, 26, 10) | 0) && W(), l2 = 91;
                    break;
                  }
                  case 99: {
                    z2(a5) | 0 && !(A3(t3 + 4 | 0, 36, 8) | 0) && P3(d4[t3 + 12 >> 1] | 0) | 0 && (b3[806] = 1), l2 = 91;
                    break;
                  }
                  case 40: {
                    h3 = r2[70] | 0, t3 = d4[400] | 0, l2 = t3 & 65535, r2[h3 + (l2 << 3) >> 2] = 1, a5 = r2[69] | 0, d4[400] = t3 + 1 << 16 >> 16, r2[h3 + (l2 << 3) + 4 >> 2] = a5, l2 = 91;
                    break;
                  }
                  case 41: {
                    if (a5 = d4[400] | 0, !(a5 << 16 >> 16)) {
                      l2 = 36;
                      break e;
                    }
                    h3 = a5 + -1 << 16 >> 16, d4[400] = h3, l2 = d4[399] | 0, a5 = l2 & 65535, l2 << 16 >> 16 && (r2[(r2[70] | 0) + ((h3 & 65535) << 3) >> 2] | 0) == 5 && (a5 = r2[(r2[71] | 0) + (a5 + -1 << 2) >> 2] | 0, h3 = a5 + 4 | 0, r2[h3 >> 2] | 0 || (r2[h3 >> 2] = (r2[69] | 0) + 2), r2[a5 + 12 >> 2] = t3 + 4, d4[399] = l2 + -1 << 16 >> 16), l2 = 91;
                    break;
                  }
                  case 123: {
                    l2 = r2[69] | 0, h3 = r2[63] | 0, t3 = l2;
                    do
                      if ((d4[l2 >> 1] | 0) == 41 & (h3 | 0) != 0 && (r2[h3 + 4 >> 2] | 0) == (l2 | 0)) if (a5 = r2[64] | 0, r2[63] = a5, a5) {
                        r2[a5 + 32 >> 2] = 0;
                        break;
                      } else {
                        r2[59] = 0;
                        break;
                      }
                    while (false);
                    h3 = r2[70] | 0, a5 = d4[400] | 0, l2 = a5 & 65535, r2[h3 + (l2 << 3) >> 2] = b3[806] | 0 ? 6 : 2, d4[400] = a5 + 1 << 16 >> 16, r2[h3 + (l2 << 3) + 4 >> 2] = t3, b3[806] = 0, l2 = 91;
                    break;
                  }
                  case 125: {
                    if (t3 = d4[400] | 0, !(t3 << 16 >> 16)) {
                      l2 = 49;
                      break e;
                    }
                    h3 = r2[70] | 0, l2 = t3 + -1 << 16 >> 16, d4[400] = l2, (r2[h3 + ((l2 & 65535) << 3) >> 2] | 0) == 4 && Ee2(), l2 = 91;
                    break;
                  }
                  case 39: {
                    I5(39), l2 = 91;
                    break;
                  }
                  case 34: {
                    I5(34), l2 = 91;
                    break;
                  }
                  case 47:
                    switch (d4[t3 + 4 >> 1] | 0) {
                      case 47: {
                        fe2();
                        break t;
                      }
                      case 42: {
                        le2(1);
                        break t;
                      }
                      default: {
                        t3 = r2[69] | 0, a5 = d4[t3 >> 1] | 0;
                        n: do
                          if (!(kt(a5) | 0)) a5 << 16 >> 16 == 41 ? (h3 = d4[400] | 0, xt(r2[(r2[70] | 0) + ((h3 & 65535) << 3) + 4 >> 2] | 0) | 0 || (l2 = 65)) : l2 = 64;
                          else switch (a5 << 16 >> 16) {
                            case 46:
                              if (((d4[t3 + -2 >> 1] | 0) + -48 & 65535) < 10) {
                                l2 = 64;
                                break n;
                              } else break n;
                            case 43:
                              if ((d4[t3 + -2 >> 1] | 0) == 43) {
                                l2 = 64;
                                break n;
                              } else break n;
                            case 45:
                              if ((d4[t3 + -2 >> 1] | 0) == 45) {
                                l2 = 64;
                                break n;
                              } else break n;
                            default:
                              break n;
                          }
                        while (false);
                        (l2 | 0) == 64 && (h3 = d4[400] | 0, l2 = 65);
                        n: do
                          if ((l2 | 0) == 65) {
                            if (l2 = 0, h3 << 16 >> 16 && (w3 = r2[70] | 0, m6 = (h3 & 65535) + -1 | 0, a5 << 16 >> 16 == 102 ? (r2[w3 + (m6 << 3) >> 2] | 0) == 1 : 0)) {
                              if ((d4[t3 + -2 >> 1] | 0) == 111 && O5(r2[w3 + (m6 << 3) + 4 >> 2] | 0, 44, 3) | 0) break;
                            } else l2 = 69;
                            if ((l2 | 0) == 69 && a5 << 16 >> 16 == 125 && (l2 = r2[70] | 0, h3 = h3 & 65535, mt(r2[l2 + (h3 << 3) + 4 >> 2] | 0) | 0 || (r2[l2 + (h3 << 3) >> 2] | 0) == 6)) break;
                            if (!(pt(t3) | 0)) {
                              switch (a5 << 16 >> 16) {
                                case 0:
                                  break n;
                                case 47: {
                                  if (b3[805] | 0) break n;
                                  break;
                                }
                                default:
                              }
                              if (l2 = r2[65] | 0, l2 | 0 && t3 >>> 0 >= (r2[l2 >> 2] | 0) >>> 0 && t3 >>> 0 <= (r2[l2 + 4 >> 2] | 0) >>> 0) {
                                ue2(), b3[805] = 0, l2 = 91;
                                break t;
                              }
                              h3 = r2[3] | 0;
                              do {
                                if (t3 >>> 0 <= h3 >>> 0) break;
                                t3 = t3 + -2 | 0, r2[69] = t3, a5 = d4[t3 >> 1] | 0;
                              } while (!(he2(a5) | 0));
                              if (ne2(a5) | 0) {
                                do {
                                  if (t3 >>> 0 <= h3 >>> 0) break;
                                  t3 = t3 + -2 | 0, r2[69] = t3;
                                } while (ne2(d4[t3 >> 1] | 0) | 0);
                                if (Ct(t3) | 0) {
                                  ue2(), b3[805] = 0, l2 = 91;
                                  break t;
                                }
                              }
                              b3[805] = 1, l2 = 91;
                              break t;
                            }
                          }
                        while (false);
                        ue2(), b3[805] = 0, l2 = 91;
                        break t;
                      }
                    }
                  case 96: {
                    h3 = r2[70] | 0, a5 = d4[400] | 0, l2 = a5 & 65535, r2[h3 + (l2 << 3) + 4 >> 2] = r2[69], d4[400] = a5 + 1 << 16 >> 16, r2[h3 + (l2 << 3) >> 2] = 3, Ee2(), l2 = 91;
                    break;
                  }
                  default:
                    l2 = 91;
                }
              while (false);
              (l2 | 0) == 91 && (l2 = 0, r2[69] = r2[72]), t3 = r2[72] | 0;
            }
            if ((l2 | 0) == 36) {
              M2(), t3 = 0;
              break;
            } else if ((l2 | 0) == 49) {
              M2(), t3 = 0;
              break;
            } else if ((l2 | 0) == 92) {
              t3 = b3[802] | 0 ? 0 : (d4[399] | d4[400]) << 16 >> 16 == 0;
              break;
            }
          }
        while (false);
        return E5 = C4, t3 | 0;
      }
      f2(N3, "b");
      function $2() {
        var t3 = 0, a5 = 0, h3 = 0, l2 = 0, w3 = 0, m6 = 0, C4 = 0, T3 = 0, ge2 = 0, be3 = 0, pe3 = 0, we3 = 0, S2 = 0, x = 0;
        T3 = r2[72] | 0, ge2 = r2[65] | 0, x = T3 + 12 | 0, r2[72] = x, h3 = k2(1) | 0, t3 = r2[72] | 0, (t3 | 0) == (x | 0) && !(te3(h3) | 0) || (S2 = 3);
        e: do
          if ((S2 | 0) == 3) {
            t: do
              switch (h3 << 16 >> 16) {
                case 123: {
                  for (r2[72] = t3 + 2, t3 = k2(1) | 0, a5 = r2[72] | 0; ; ) {
                    if (H3(t3) | 0 ? (I5(t3), t3 = (r2[72] | 0) + 2 | 0, r2[72] = t3) : (j2(t3) | 0, t3 = r2[72] | 0), k2(1) | 0, t3 = Le2(a5, t3) | 0, t3 << 16 >> 16 == 44 && (r2[72] = (r2[72] | 0) + 2, t3 = k2(1) | 0), t3 << 16 >> 16 == 125) {
                      S2 = 15;
                      break;
                    }
                    if (x = a5, a5 = r2[72] | 0, (a5 | 0) == (x | 0)) {
                      S2 = 12;
                      break;
                    }
                    if (a5 >>> 0 > (r2[73] | 0) >>> 0) {
                      S2 = 14;
                      break;
                    }
                  }
                  if ((S2 | 0) == 12) {
                    M2();
                    break e;
                  } else if ((S2 | 0) == 14) {
                    M2();
                    break e;
                  } else if ((S2 | 0) == 15) {
                    b3[803] = 1, r2[72] = (r2[72] | 0) + 2;
                    break t;
                  }
                  break;
                }
                case 42: {
                  r2[72] = t3 + 2, k2(1) | 0, x = r2[72] | 0, Le2(x, x) | 0;
                  break;
                }
                default: {
                  switch (b3[804] = 0, h3 << 16 >> 16) {
                    case 100: {
                      switch (T3 = t3 + 14 | 0, r2[72] = T3, (k2(1) | 0) << 16 >> 16) {
                        case 97: {
                          a5 = r2[72] | 0, !(A3(a5 + 2 | 0, 72, 8) | 0) && (w3 = a5 + 10 | 0, ne2(d4[w3 >> 1] | 0) | 0) && (r2[72] = w3, k2(0) | 0, S2 = 22);
                          break;
                        }
                        case 102: {
                          S2 = 22;
                          break;
                        }
                        case 99: {
                          a5 = r2[72] | 0, !(A3(a5 + 2 | 0, 36, 8) | 0) && (l2 = a5 + 10 | 0, x = d4[l2 >> 1] | 0, P3(x) | 0 | x << 16 >> 16 == 123) && (r2[72] = l2, m6 = k2(1) | 0, m6 << 16 >> 16 != 123) && (we3 = m6, S2 = 31);
                          break;
                        }
                        default:
                      }
                      n: do
                        if ((S2 | 0) == 22 && (C4 = r2[72] | 0, (A3(C4 + 2 | 0, 80, 14) | 0) == 0)) {
                          if (h3 = C4 + 16 | 0, a5 = d4[h3 >> 1] | 0, !(P3(a5) | 0)) switch (a5 << 16 >> 16) {
                            case 40:
                            case 42:
                              break;
                            default:
                              break n;
                          }
                          r2[72] = h3, a5 = k2(1) | 0, a5 << 16 >> 16 == 42 && (r2[72] = (r2[72] | 0) + 2, a5 = k2(1) | 0), a5 << 16 >> 16 != 40 && (we3 = a5, S2 = 31);
                        }
                      while (false);
                      if ((S2 | 0) == 31 && (be3 = r2[72] | 0, j2(we3) | 0, pe3 = r2[72] | 0, pe3 >>> 0 > be3 >>> 0)) {
                        B2(t3, T3, be3, pe3), r2[72] = (r2[72] | 0) + -2;
                        break e;
                      }
                      B2(t3, T3, 0, 0), r2[72] = t3 + 12;
                      break e;
                    }
                    case 97: {
                      r2[72] = t3 + 10, k2(0) | 0, t3 = r2[72] | 0, S2 = 35;
                      break;
                    }
                    case 102: {
                      S2 = 35;
                      break;
                    }
                    case 99: {
                      if (!(A3(t3 + 2 | 0, 36, 8) | 0) && (a5 = t3 + 10 | 0, he2(d4[a5 >> 1] | 0) | 0)) {
                        r2[72] = a5, x = k2(1) | 0, S2 = r2[72] | 0, j2(x) | 0, x = r2[72] | 0, B2(S2, x, S2, x), r2[72] = (r2[72] | 0) + -2;
                        break e;
                      }
                      t3 = t3 + 4 | 0, r2[72] = t3;
                      break;
                    }
                    case 108:
                    case 118:
                      break;
                    default:
                      break e;
                  }
                  if ((S2 | 0) == 35) {
                    r2[72] = t3 + 16, t3 = k2(1) | 0, t3 << 16 >> 16 == 42 && (r2[72] = (r2[72] | 0) + 2, t3 = k2(1) | 0), S2 = r2[72] | 0, j2(t3) | 0, x = r2[72] | 0, B2(S2, x, S2, x), r2[72] = (r2[72] | 0) + -2;
                    break e;
                  }
                  r2[72] = t3 + 6, b3[804] = 0, h3 = k2(1) | 0, t3 = r2[72] | 0, h3 = (j2(h3) | 0 | 32) << 16 >> 16 == 123, l2 = r2[72] | 0, h3 && (r2[72] = l2 + 2, x = k2(1) | 0, t3 = r2[72] | 0, j2(x) | 0);
                  n: for (; a5 = r2[72] | 0, (a5 | 0) != (t3 | 0); ) {
                    if (B2(t3, a5, t3, a5), a5 = k2(1) | 0, h3) switch (a5 << 16 >> 16) {
                      case 93:
                      case 125:
                        break e;
                      default:
                    }
                    if (t3 = r2[72] | 0, a5 << 16 >> 16 != 44) {
                      S2 = 51;
                      break;
                    }
                    switch (r2[72] = t3 + 2, a5 = k2(1) | 0, t3 = r2[72] | 0, a5 << 16 >> 16) {
                      case 91:
                      case 123: {
                        S2 = 51;
                        break n;
                      }
                      default:
                    }
                    j2(a5) | 0;
                  }
                  if ((S2 | 0) == 51 && (r2[72] = t3 + -2), !h3) break e;
                  r2[72] = l2 + -2;
                  break e;
                }
              }
            while (false);
            if (x = (k2(1) | 0) << 16 >> 16 == 102, t3 = r2[72] | 0, x && !(A3(t3 + 2 | 0, 66, 6) | 0)) for (r2[72] = t3 + 8, G3(T3, k2(1) | 0, 0), t3 = ge2 | 0 ? ge2 + 16 | 0 : 240; ; ) {
              if (t3 = r2[t3 >> 2] | 0, !t3) break e;
              r2[t3 + 12 >> 2] = 0, r2[t3 + 8 >> 2] = 0, t3 = t3 + 16 | 0;
            }
            r2[72] = t3 + -2;
          }
        while (false);
      }
      f2($2, "k");
      function W() {
        var t3 = 0, a5 = 0, h3 = 0, l2 = 0, w3 = 0, m6 = 0, C4 = 0;
        w3 = r2[72] | 0, h3 = w3 + 12 | 0, r2[72] = h3, l2 = k2(1) | 0, a5 = r2[72] | 0;
        e: do
          if (l2 << 16 >> 16 != 46) l2 << 16 >> 16 == 115 & a5 >>> 0 > h3 >>> 0 ? !(A3(a5 + 2 | 0, 56, 10) | 0) && (t3 = a5 + 12 | 0, P3(d4[t3 >> 1] | 0) | 0) ? m6 = 14 : (a5 = 6, h3 = 0, m6 = 46) : (t3 = l2, h3 = 0, m6 = 15);
          else switch (r2[72] = a5 + 2, (k2(1) | 0) << 16 >> 16) {
            case 109: {
              if (t3 = r2[72] | 0, A3(t3 + 2 | 0, 50, 6) | 0 || (a5 = r2[69] | 0, !(de2(a5) | 0) && (d4[a5 >> 1] | 0) == 46)) break e;
              ce2(w3, w3, t3 + 8 | 0, 2);
              break e;
            }
            case 115: {
              if (t3 = r2[72] | 0, A3(t3 + 2 | 0, 56, 10) | 0 || (a5 = r2[69] | 0, !(de2(a5) | 0) && (d4[a5 >> 1] | 0) == 46)) break e;
              t3 = t3 + 12 | 0, m6 = 14;
              break e;
            }
            default:
              break e;
          }
        while (false);
        (m6 | 0) == 14 && (r2[72] = t3, t3 = k2(1) | 0, h3 = 1, m6 = 15);
        e: do
          if ((m6 | 0) == 15) switch (t3 << 16 >> 16) {
            case 40: {
              if (a5 = r2[70] | 0, C4 = d4[400] | 0, l2 = C4 & 65535, r2[a5 + (l2 << 3) >> 2] = 5, t3 = r2[72] | 0, d4[400] = C4 + 1 << 16 >> 16, r2[a5 + (l2 << 3) + 4 >> 2] = t3, (d4[r2[69] >> 1] | 0) == 46) break e;
              switch (r2[72] = t3 + 2, a5 = k2(1) | 0, ce2(w3, r2[72] | 0, 0, t3), h3 ? (t3 = r2[63] | 0, r2[t3 + 28 >> 2] = 5) : t3 = r2[63] | 0, w3 = r2[71] | 0, C4 = d4[399] | 0, d4[399] = C4 + 1 << 16 >> 16, r2[w3 + ((C4 & 65535) << 2) >> 2] = t3, a5 << 16 >> 16) {
                case 39: {
                  I5(39);
                  break;
                }
                case 34: {
                  I5(34);
                  break;
                }
                default: {
                  r2[72] = (r2[72] | 0) + -2;
                  break e;
                }
              }
              switch (t3 = (r2[72] | 0) + 2 | 0, r2[72] = t3, (k2(1) | 0) << 16 >> 16) {
                case 44: {
                  r2[72] = (r2[72] | 0) + 2, k2(1) | 0, w3 = r2[63] | 0, r2[w3 + 4 >> 2] = t3, C4 = r2[72] | 0, r2[w3 + 16 >> 2] = C4, b3[w3 + 24 >> 0] = 1, r2[72] = C4 + -2;
                  break e;
                }
                case 41: {
                  d4[400] = (d4[400] | 0) + -1 << 16 >> 16, C4 = r2[63] | 0, r2[C4 + 4 >> 2] = t3, r2[C4 + 12 >> 2] = (r2[72] | 0) + 2, b3[C4 + 24 >> 0] = 1, d4[399] = (d4[399] | 0) + -1 << 16 >> 16;
                  break e;
                }
                default: {
                  r2[72] = (r2[72] | 0) + -2;
                  break e;
                }
              }
            }
            case 123: {
              if (h3) {
                a5 = 12, h3 = 1, m6 = 46;
                break e;
              }
              if (t3 = r2[72] | 0, d4[400] | 0) {
                r2[72] = t3 + -2;
                break e;
              }
              for (; !(t3 >>> 0 >= (r2[73] | 0) >>> 0); ) {
                if (t3 = k2(1) | 0, H3(t3) | 0) I5(t3);
                else if (t3 << 16 >> 16 == 125) {
                  m6 = 36;
                  break;
                }
                t3 = (r2[72] | 0) + 2 | 0, r2[72] = t3;
              }
              if ((m6 | 0) == 36 && (r2[72] = (r2[72] | 0) + 2), C4 = (k2(1) | 0) << 16 >> 16 == 102, t3 = r2[72] | 0, C4 && A3(t3 + 2 | 0, 66, 6) | 0) {
                M2();
                break e;
              }
              if (r2[72] = t3 + 8, t3 = k2(1) | 0, H3(t3) | 0) {
                G3(w3, t3, 0);
                break e;
              } else {
                M2();
                break e;
              }
            }
            default: {
              if (h3) {
                a5 = 12, h3 = 1, m6 = 46;
                break e;
              }
              switch (t3 << 16 >> 16) {
                case 42:
                case 39:
                case 34: {
                  h3 = 0, m6 = 48;
                  break e;
                }
                default: {
                  a5 = 6, h3 = 0, m6 = 46;
                  break e;
                }
              }
            }
          }
        while (false);
        (m6 | 0) == 46 && (t3 = r2[72] | 0, (t3 | 0) == (w3 + (a5 << 1) | 0) ? r2[72] = t3 + -2 : m6 = 48);
        do
          if ((m6 | 0) == 48) {
            if (d4[400] | 0) {
              r2[72] = (r2[72] | 0) + -2;
              break;
            }
            for (t3 = r2[73] | 0, a5 = r2[72] | 0; ; ) {
              if (a5 >>> 0 >= t3 >>> 0) {
                m6 = 55;
                break;
              }
              if (l2 = d4[a5 >> 1] | 0, H3(l2) | 0) {
                m6 = 53;
                break;
              }
              C4 = a5 + 2 | 0, r2[72] = C4, a5 = C4;
            }
            if ((m6 | 0) == 53) {
              G3(w3, l2, h3);
              break;
            } else if ((m6 | 0) == 55) {
              M2();
              break;
            }
          }
        while (false);
      }
      f2(W, "l");
      function G3(t3, a5, h3) {
        t3 = t3 | 0, a5 = a5 | 0, h3 = h3 | 0;
        var l2 = 0, w3 = 0;
        switch (l2 = (r2[72] | 0) + 2 | 0, a5 << 16 >> 16) {
          case 39: {
            I5(39), w3 = 5;
            break;
          }
          case 34: {
            I5(34), w3 = 5;
            break;
          }
          default:
            M2();
        }
        do
          if ((w3 | 0) == 5) {
            if (ce2(t3, l2, r2[72] | 0, 1), h3 && (r2[(r2[63] | 0) + 28 >> 2] = 4), r2[72] = (r2[72] | 0) + 2, a5 = k2(0) | 0, h3 = a5 << 16 >> 16 == 97, h3 ? (l2 = r2[72] | 0, A3(l2 + 2 | 0, 94, 10) | 0 && (w3 = 13)) : (l2 = r2[72] | 0, a5 << 16 >> 16 == 119 && (d4[l2 + 2 >> 1] | 0) == 105 && (d4[l2 + 4 >> 1] | 0) == 116 && (d4[l2 + 6 >> 1] | 0) == 104 || (w3 = 13)), (w3 | 0) == 13) {
              r2[72] = l2 + -2;
              break;
            }
            if (r2[72] = l2 + ((h3 ? 6 : 4) << 1), (k2(1) | 0) << 16 >> 16 != 123) {
              r2[72] = l2;
              break;
            }
            h3 = r2[72] | 0, a5 = h3;
            e: for (; ; ) {
              switch (r2[72] = a5 + 2, a5 = k2(1) | 0, a5 << 16 >> 16) {
                case 39: {
                  I5(39), r2[72] = (r2[72] | 0) + 2, a5 = k2(1) | 0;
                  break;
                }
                case 34: {
                  I5(34), r2[72] = (r2[72] | 0) + 2, a5 = k2(1) | 0;
                  break;
                }
                default:
                  a5 = j2(a5) | 0;
              }
              if (a5 << 16 >> 16 != 58) {
                w3 = 22;
                break;
              }
              switch (r2[72] = (r2[72] | 0) + 2, (k2(1) | 0) << 16 >> 16) {
                case 39: {
                  I5(39);
                  break;
                }
                case 34: {
                  I5(34);
                  break;
                }
                default: {
                  w3 = 26;
                  break e;
                }
              }
              switch (r2[72] = (r2[72] | 0) + 2, (k2(1) | 0) << 16 >> 16) {
                case 125: {
                  w3 = 31;
                  break e;
                }
                case 44:
                  break;
                default: {
                  w3 = 30;
                  break e;
                }
              }
              if (r2[72] = (r2[72] | 0) + 2, (k2(1) | 0) << 16 >> 16 == 125) {
                w3 = 31;
                break;
              }
              a5 = r2[72] | 0;
            }
            if ((w3 | 0) == 22) {
              r2[72] = l2;
              break;
            } else if ((w3 | 0) == 26) {
              r2[72] = l2;
              break;
            } else if ((w3 | 0) == 30) {
              r2[72] = l2;
              break;
            } else if ((w3 | 0) == 31) {
              w3 = r2[63] | 0, r2[w3 + 16 >> 2] = h3, r2[w3 + 12 >> 2] = (r2[72] | 0) + 2;
              break;
            }
          }
        while (false);
      }
      f2(G3, "u");
      function pt(t3) {
        t3 = t3 | 0;
        e: do
          switch (d4[t3 >> 1] | 0) {
            case 100:
              switch (d4[t3 + -2 >> 1] | 0) {
                case 105: {
                  t3 = O5(t3 + -4 | 0, 104, 2) | 0;
                  break e;
                }
                case 108: {
                  t3 = O5(t3 + -4 | 0, 108, 3) | 0;
                  break e;
                }
                default: {
                  t3 = 0;
                  break e;
                }
              }
            case 101:
              switch (d4[t3 + -2 >> 1] | 0) {
                case 115:
                  switch (d4[t3 + -4 >> 1] | 0) {
                    case 108: {
                      t3 = q2(t3 + -6 | 0, 101) | 0;
                      break e;
                    }
                    case 97: {
                      t3 = q2(t3 + -6 | 0, 99) | 0;
                      break e;
                    }
                    default: {
                      t3 = 0;
                      break e;
                    }
                  }
                case 116: {
                  t3 = O5(t3 + -4 | 0, 114, 4) | 0;
                  break e;
                }
                case 117: {
                  t3 = O5(t3 + -4 | 0, 122, 6) | 0;
                  break e;
                }
                default: {
                  t3 = 0;
                  break e;
                }
              }
            case 102: {
              if ((d4[t3 + -2 >> 1] | 0) == 111 && (d4[t3 + -4 >> 1] | 0) == 101) switch (d4[t3 + -6 >> 1] | 0) {
                case 99: {
                  t3 = O5(t3 + -8 | 0, 134, 6) | 0;
                  break e;
                }
                case 112: {
                  t3 = O5(t3 + -8 | 0, 146, 2) | 0;
                  break e;
                }
                default: {
                  t3 = 0;
                  break e;
                }
              }
              else t3 = 0;
              break;
            }
            case 107: {
              t3 = O5(t3 + -2 | 0, 150, 4) | 0;
              break;
            }
            case 110: {
              t3 = t3 + -2 | 0, q2(t3, 105) | 0 ? t3 = 1 : t3 = O5(t3, 158, 5) | 0;
              break;
            }
            case 111: {
              t3 = q2(t3 + -2 | 0, 100) | 0;
              break;
            }
            case 114: {
              t3 = O5(t3 + -2 | 0, 168, 7) | 0;
              break;
            }
            case 116: {
              t3 = O5(t3 + -2 | 0, 182, 4) | 0;
              break;
            }
            case 119:
              switch (d4[t3 + -2 >> 1] | 0) {
                case 101: {
                  t3 = q2(t3 + -4 | 0, 110) | 0;
                  break e;
                }
                case 111: {
                  t3 = O5(t3 + -4 | 0, 190, 3) | 0;
                  break e;
                }
                default: {
                  t3 = 0;
                  break e;
                }
              }
            default:
              t3 = 0;
          }
        while (false);
        return t3 | 0;
      }
      f2(pt, "o");
      function Ee2() {
        var t3 = 0, a5 = 0, h3 = 0, l2 = 0;
        a5 = r2[73] | 0, h3 = r2[72] | 0;
        e: for (; ; ) {
          if (t3 = h3 + 2 | 0, h3 >>> 0 >= a5 >>> 0) {
            a5 = 10;
            break;
          }
          switch (d4[t3 >> 1] | 0) {
            case 96: {
              a5 = 7;
              break e;
            }
            case 36: {
              if ((d4[h3 + 4 >> 1] | 0) == 123) {
                a5 = 6;
                break e;
              }
              break;
            }
            case 92: {
              t3 = h3 + 4 | 0;
              break;
            }
            default:
          }
          h3 = t3;
        }
        (a5 | 0) == 6 ? (t3 = h3 + 4 | 0, r2[72] = t3, a5 = r2[70] | 0, l2 = d4[400] | 0, h3 = l2 & 65535, r2[a5 + (h3 << 3) >> 2] = 4, d4[400] = l2 + 1 << 16 >> 16, r2[a5 + (h3 << 3) + 4 >> 2] = t3) : (a5 | 0) == 7 ? (r2[72] = t3, h3 = r2[70] | 0, l2 = (d4[400] | 0) + -1 << 16 >> 16, d4[400] = l2, (r2[h3 + ((l2 & 65535) << 3) >> 2] | 0) != 3 && M2()) : (a5 | 0) == 10 && (r2[72] = t3, M2());
      }
      f2(Ee2, "h");
      function k2(t3) {
        t3 = t3 | 0;
        var a5 = 0, h3 = 0, l2 = 0;
        h3 = r2[72] | 0;
        e: do {
          a5 = d4[h3 >> 1] | 0;
          t: do
            if (a5 << 16 >> 16 != 47) if (t3) {
              if (P3(a5) | 0) break;
              break e;
            } else {
              if (ne2(a5) | 0) break;
              break e;
            }
            else switch (d4[h3 + 2 >> 1] | 0) {
              case 47: {
                fe2();
                break t;
              }
              case 42: {
                le2(t3);
                break t;
              }
              default: {
                a5 = 47;
                break e;
              }
            }
          while (false);
          l2 = r2[72] | 0, h3 = l2 + 2 | 0, r2[72] = h3;
        } while (l2 >>> 0 < (r2[73] | 0) >>> 0);
        return a5 | 0;
      }
      f2(k2, "w");
      function ce2(t3, a5, h3, l2) {
        t3 = t3 | 0, a5 = a5 | 0, h3 = h3 | 0, l2 = l2 | 0;
        var w3 = 0, m6 = 0;
        m6 = r2[67] | 0, r2[67] = m6 + 36, w3 = r2[63] | 0, r2[(w3 | 0 ? w3 + 32 | 0 : 236) >> 2] = m6, r2[64] = w3, r2[63] = m6, r2[m6 + 8 >> 2] = t3, (l2 | 0) == 2 ? (t3 = 3, w3 = h3) : (w3 = (l2 | 0) == 1, t3 = w3 ? 1 : 2, w3 = w3 ? h3 + 2 | 0 : 0), r2[m6 + 12 >> 2] = w3, r2[m6 + 28 >> 2] = t3, r2[m6 >> 2] = a5, r2[m6 + 4 >> 2] = h3, r2[m6 + 16 >> 2] = 0, r2[m6 + 20 >> 2] = l2, a5 = (l2 | 0) == 1, b3[m6 + 24 >> 0] = a5 & 1, r2[m6 + 32 >> 2] = 0, a5 | (l2 | 0) == 2 && (b3[803] = 1);
      }
      f2(ce2, "d");
      function I5(t3) {
        t3 = t3 | 0;
        var a5 = 0, h3 = 0, l2 = 0, w3 = 0;
        for (w3 = r2[73] | 0, a5 = r2[72] | 0; ; ) {
          if (l2 = a5 + 2 | 0, a5 >>> 0 >= w3 >>> 0) {
            a5 = 9;
            break;
          }
          if (h3 = d4[l2 >> 1] | 0, h3 << 16 >> 16 == t3 << 16 >> 16) {
            a5 = 10;
            break;
          }
          if (h3 << 16 >> 16 == 92) h3 = a5 + 4 | 0, (d4[h3 >> 1] | 0) == 13 ? (a5 = a5 + 6 | 0, a5 = (d4[a5 >> 1] | 0) == 10 ? a5 : h3) : a5 = h3;
          else if (Re2(h3) | 0) {
            a5 = 9;
            break;
          } else a5 = l2;
        }
        (a5 | 0) == 9 ? (r2[72] = l2, M2()) : (a5 | 0) == 10 && (r2[72] = l2);
      }
      f2(I5, "v");
      function Le2(t3, a5) {
        t3 = t3 | 0, a5 = a5 | 0;
        var h3 = 0, l2 = 0, w3 = 0, m6 = 0;
        return h3 = r2[72] | 0, l2 = d4[h3 >> 1] | 0, m6 = (t3 | 0) == (a5 | 0), w3 = m6 ? 0 : t3, m6 = m6 ? 0 : a5, l2 << 16 >> 16 == 97 && (r2[72] = h3 + 4, h3 = k2(1) | 0, t3 = r2[72] | 0, H3(h3) | 0 ? (I5(h3), a5 = (r2[72] | 0) + 2 | 0, r2[72] = a5) : (j2(h3) | 0, a5 = r2[72] | 0), l2 = k2(1) | 0, h3 = r2[72] | 0), (h3 | 0) != (t3 | 0) && B2(t3, a5, w3, m6), l2 | 0;
      }
      f2(Le2, "A");
      function wt() {
        var t3 = 0, a5 = 0, h3 = 0;
        h3 = r2[73] | 0, a5 = r2[72] | 0;
        e: for (; ; ) {
          if (t3 = a5 + 2 | 0, a5 >>> 0 >= h3 >>> 0) {
            a5 = 6;
            break;
          }
          switch (d4[t3 >> 1] | 0) {
            case 13:
            case 10: {
              a5 = 6;
              break e;
            }
            case 93: {
              a5 = 7;
              break e;
            }
            case 92: {
              t3 = a5 + 4 | 0;
              break;
            }
            default:
          }
          a5 = t3;
        }
        return (a5 | 0) == 6 ? (r2[72] = t3, M2(), t3 = 0) : (a5 | 0) == 7 && (r2[72] = t3, t3 = 93), t3 | 0;
      }
      f2(wt, "C");
      function ue2() {
        var t3 = 0, a5 = 0, h3 = 0;
        e: for (; ; ) {
          if (t3 = r2[72] | 0, a5 = t3 + 2 | 0, r2[72] = a5, t3 >>> 0 >= (r2[73] | 0) >>> 0) {
            h3 = 7;
            break;
          }
          switch (d4[a5 >> 1] | 0) {
            case 13:
            case 10: {
              h3 = 7;
              break e;
            }
            case 47:
              break e;
            case 91: {
              wt() | 0;
              break;
            }
            case 92: {
              r2[72] = t3 + 4;
              break;
            }
            default:
          }
        }
        (h3 | 0) == 7 && M2();
      }
      f2(ue2, "g");
      function mt(t3) {
        switch (t3 = t3 | 0, d4[t3 >> 1] | 0) {
          case 62: {
            t3 = (d4[t3 + -2 >> 1] | 0) == 61;
            break;
          }
          case 41:
          case 59: {
            t3 = 1;
            break;
          }
          case 104: {
            t3 = O5(t3 + -2 | 0, 210, 4) | 0;
            break;
          }
          case 121: {
            t3 = O5(t3 + -2 | 0, 218, 6) | 0;
            break;
          }
          case 101: {
            t3 = O5(t3 + -2 | 0, 230, 3) | 0;
            break;
          }
          default:
            t3 = 0;
        }
        return t3 | 0;
      }
      f2(mt, "p");
      function le2(t3) {
        t3 = t3 | 0;
        var a5 = 0, h3 = 0, l2 = 0, w3 = 0, m6 = 0;
        for (w3 = (r2[72] | 0) + 2 | 0, r2[72] = w3, h3 = r2[73] | 0; a5 = w3 + 2 | 0, !(w3 >>> 0 >= h3 >>> 0 || (l2 = d4[a5 >> 1] | 0, !t3 && Re2(l2) | 0)); ) {
          if (l2 << 16 >> 16 == 42 && (d4[w3 + 4 >> 1] | 0) == 47) {
            m6 = 8;
            break;
          }
          w3 = a5;
        }
        (m6 | 0) == 8 && (r2[72] = a5, a5 = w3 + 4 | 0), r2[72] = a5;
      }
      f2(le2, "y");
      function A3(t3, a5, h3) {
        t3 = t3 | 0, a5 = a5 | 0, h3 = h3 | 0;
        var l2 = 0, w3 = 0;
        e: do
          if (!h3) t3 = 0;
          else {
            for (; l2 = b3[t3 >> 0] | 0, w3 = b3[a5 >> 0] | 0, l2 << 24 >> 24 == w3 << 24 >> 24; ) if (h3 = h3 + -1 | 0, h3) t3 = t3 + 1 | 0, a5 = a5 + 1 | 0;
            else {
              t3 = 0;
              break e;
            }
            t3 = (l2 & 255) - (w3 & 255) | 0;
          }
        while (false);
        return t3 | 0;
      }
      f2(A3, "m");
      function te3(t3) {
        t3 = t3 | 0;
        e: do
          switch (t3 << 16 >> 16) {
            case 38:
            case 37:
            case 33: {
              t3 = 1;
              break;
            }
            default:
              if ((t3 & -8) << 16 >> 16 == 40 | (t3 + -58 & 65535) < 6) t3 = 1;
              else {
                switch (t3 << 16 >> 16) {
                  case 91:
                  case 93:
                  case 94: {
                    t3 = 1;
                    break e;
                  }
                  default:
                }
                t3 = (t3 + -123 & 65535) < 4;
              }
          }
        while (false);
        return t3 | 0;
      }
      f2(te3, "I");
      function kt(t3) {
        t3 = t3 | 0;
        e: do
          switch (t3 << 16 >> 16) {
            case 38:
            case 37:
            case 33:
              break;
            default:
              if (!((t3 + -58 & 65535) < 6 | (t3 + -40 & 65535) < 7 & t3 << 16 >> 16 != 41)) {
                switch (t3 << 16 >> 16) {
                  case 91:
                  case 94:
                    break e;
                  default:
                }
                return t3 << 16 >> 16 != 125 & (t3 + -123 & 65535) < 4 | 0;
              }
          }
        while (false);
        return 1;
      }
      f2(kt, "U");
      function Oe2(t3) {
        t3 = t3 | 0;
        var a5 = 0;
        a5 = d4[t3 >> 1] | 0;
        e: do
          if ((a5 + -9 & 65535) >= 5) {
            switch (a5 << 16 >> 16) {
              case 160:
              case 32: {
                a5 = 1;
                break e;
              }
              default:
            }
            if (te3(a5) | 0) return a5 << 16 >> 16 != 46 | (de2(t3) | 0) | 0;
            a5 = 0;
          } else a5 = 1;
        while (false);
        return a5 | 0;
      }
      f2(Oe2, "x");
      function yt(t3) {
        t3 = t3 | 0;
        var a5 = 0, h3 = 0, l2 = 0, w3 = 0;
        return h3 = E5, E5 = E5 + 16 | 0, l2 = h3, r2[l2 >> 2] = 0, r2[66] = t3, a5 = r2[3] | 0, w3 = a5 + (t3 << 1) | 0, t3 = w3 + 2 | 0, d4[w3 >> 1] = 0, r2[l2 >> 2] = t3, r2[67] = t3, r2[59] = 0, r2[63] = 0, r2[61] = 0, r2[60] = 0, r2[65] = 0, r2[62] = 0, E5 = h3, a5 | 0;
      }
      f2(yt, "S");
      function B2(t3, a5, h3, l2) {
        t3 = t3 | 0, a5 = a5 | 0, h3 = h3 | 0, l2 = l2 | 0;
        var w3 = 0, m6 = 0;
        w3 = r2[67] | 0, r2[67] = w3 + 20, m6 = r2[65] | 0, r2[(m6 | 0 ? m6 + 16 | 0 : 240) >> 2] = w3, r2[65] = w3, r2[w3 >> 2] = t3, r2[w3 + 4 >> 2] = a5, r2[w3 + 8 >> 2] = h3, r2[w3 + 12 >> 2] = l2, r2[w3 + 16 >> 2] = 0, b3[803] = 1;
      }
      f2(B2, "O");
      function O5(t3, a5, h3) {
        t3 = t3 | 0, a5 = a5 | 0, h3 = h3 | 0;
        var l2 = 0, w3 = 0;
        return l2 = t3 + (0 - h3 << 1) | 0, w3 = l2 + 2 | 0, t3 = r2[3] | 0, w3 >>> 0 >= t3 >>> 0 && !(A3(w3, a5, h3 << 1) | 0) ? (w3 | 0) == (t3 | 0) ? t3 = 1 : t3 = Oe2(l2) | 0 : t3 = 0, t3 | 0;
      }
      f2(O5, "$");
      function Ct(t3) {
        switch (t3 = t3 | 0, d4[t3 >> 1] | 0) {
          case 107: {
            t3 = O5(t3 + -2 | 0, 150, 4) | 0;
            break;
          }
          case 101: {
            (d4[t3 + -2 >> 1] | 0) == 117 ? t3 = O5(t3 + -4 | 0, 122, 6) | 0 : t3 = 0;
            break;
          }
          default:
            t3 = 0;
        }
        return t3 | 0;
      }
      f2(Ct, "j");
      function q2(t3, a5) {
        t3 = t3 | 0, a5 = a5 | 0;
        var h3 = 0;
        return h3 = r2[3] | 0, h3 >>> 0 <= t3 >>> 0 && (d4[t3 >> 1] | 0) == a5 << 16 >> 16 ? (h3 | 0) == (t3 | 0) ? h3 = 1 : h3 = he2(d4[t3 + -2 >> 1] | 0) | 0 : h3 = 0, h3 | 0;
      }
      f2(q2, "B");
      function he2(t3) {
        t3 = t3 | 0;
        e: do
          if ((t3 + -9 & 65535) < 5) t3 = 1;
          else {
            switch (t3 << 16 >> 16) {
              case 32:
              case 160: {
                t3 = 1;
                break e;
              }
              default:
            }
            t3 = t3 << 16 >> 16 != 46 & (te3(t3) | 0);
          }
        while (false);
        return t3 | 0;
      }
      f2(he2, "E");
      function fe2() {
        var t3 = 0, a5 = 0, h3 = 0;
        t3 = r2[73] | 0, h3 = r2[72] | 0;
        e: for (; a5 = h3 + 2 | 0, !(h3 >>> 0 >= t3 >>> 0); ) switch (d4[a5 >> 1] | 0) {
          case 13:
          case 10:
            break e;
          default:
            h3 = a5;
        }
        r2[72] = a5;
      }
      f2(fe2, "P");
      function j2(t3) {
        for (t3 = t3 | 0; !(P3(t3) | 0 || te3(t3) | 0); ) if (t3 = (r2[72] | 0) + 2 | 0, r2[72] = t3, t3 = d4[t3 >> 1] | 0, !(t3 << 16 >> 16)) {
          t3 = 0;
          break;
        }
        return t3 | 0;
      }
      f2(j2, "q");
      function St() {
        var t3 = 0;
        switch (t3 = r2[(r2[61] | 0) + 20 >> 2] | 0, t3 | 0) {
          case 1: {
            t3 = -1;
            break;
          }
          case 2: {
            t3 = -2;
            break;
          }
          default:
            t3 = t3 - (r2[3] | 0) >> 1;
        }
        return t3 | 0;
      }
      f2(St, "z");
      function xt(t3) {
        return t3 = t3 | 0, !(O5(t3, 196, 5) | 0) && !(O5(t3, 44, 3) | 0) ? t3 = O5(t3, 206, 2) | 0 : t3 = 1, t3 | 0;
      }
      f2(xt, "D");
      function ne2(t3) {
        switch (t3 = t3 | 0, t3 << 16 >> 16) {
          case 160:
          case 32:
          case 12:
          case 11:
          case 9: {
            t3 = 1;
            break;
          }
          default:
            t3 = 0;
        }
        return t3 | 0;
      }
      f2(ne2, "F");
      function de2(t3) {
        return t3 = t3 | 0, (d4[t3 >> 1] | 0) == 46 && (d4[t3 + -2 >> 1] | 0) == 46 ? t3 = (d4[t3 + -4 >> 1] | 0) == 46 : t3 = 0, t3 | 0;
      }
      f2(de2, "G");
      function z2(t3) {
        return t3 = t3 | 0, (r2[3] | 0) == (t3 | 0) ? t3 = 1 : t3 = Oe2(t3 + -2 | 0) | 0, t3 | 0;
      }
      f2(z2, "H");
      function vt() {
        var t3 = 0;
        return t3 = r2[(r2[62] | 0) + 12 >> 2] | 0, t3 ? t3 = t3 - (r2[3] | 0) >> 1 : t3 = -1, t3 | 0;
      }
      f2(vt, "J");
      function _t() {
        var t3 = 0;
        return t3 = r2[(r2[61] | 0) + 12 >> 2] | 0, t3 ? t3 = t3 - (r2[3] | 0) >> 1 : t3 = -1, t3 | 0;
      }
      f2(_t, "K");
      function Et() {
        var t3 = 0;
        return t3 = r2[(r2[62] | 0) + 8 >> 2] | 0, t3 ? t3 = t3 - (r2[3] | 0) >> 1 : t3 = -1, t3 | 0;
      }
      f2(Et, "L");
      function Lt() {
        var t3 = 0;
        return t3 = r2[(r2[61] | 0) + 16 >> 2] | 0, t3 ? t3 = t3 - (r2[3] | 0) >> 1 : t3 = -1, t3 | 0;
      }
      f2(Lt, "M");
      function Ot() {
        var t3 = 0;
        return t3 = r2[(r2[61] | 0) + 4 >> 2] | 0, t3 ? t3 = t3 - (r2[3] | 0) >> 1 : t3 = -1, t3 | 0;
      }
      f2(Ot, "N");
      function Rt() {
        var t3 = 0;
        return t3 = r2[61] | 0, t3 = r2[(t3 | 0 ? t3 + 32 | 0 : 236) >> 2] | 0, r2[61] = t3, (t3 | 0) != 0 | 0;
      }
      f2(Rt, "Q");
      function At() {
        var t3 = 0;
        return t3 = r2[62] | 0, t3 = r2[(t3 | 0 ? t3 + 16 | 0 : 240) >> 2] | 0, r2[62] = t3, (t3 | 0) != 0 | 0;
      }
      f2(At, "R");
      function M2() {
        b3[802] = 1, r2[68] = (r2[72] | 0) - (r2[3] | 0) >> 1, r2[72] = (r2[73] | 0) + 2;
      }
      f2(M2, "T");
      function P3(t3) {
        return t3 = t3 | 0, (t3 | 128) << 16 >> 16 == 160 | (t3 + -9 & 65535) < 5 | 0;
      }
      f2(P3, "V");
      function H3(t3) {
        return t3 = t3 | 0, t3 << 16 >> 16 == 39 | t3 << 16 >> 16 == 34 | 0;
      }
      f2(H3, "W");
      function Nt() {
        return (r2[(r2[61] | 0) + 8 >> 2] | 0) - (r2[3] | 0) >> 1 | 0;
      }
      f2(Nt, "X");
      function It() {
        return (r2[(r2[62] | 0) + 4 >> 2] | 0) - (r2[3] | 0) >> 1 | 0;
      }
      f2(It, "Y");
      function Re2(t3) {
        return t3 = t3 | 0, t3 << 16 >> 16 == 13 | t3 << 16 >> 16 == 10 | 0;
      }
      f2(Re2, "Z");
      function Mt() {
        return (r2[r2[61] >> 2] | 0) - (r2[3] | 0) >> 1 | 0;
      }
      f2(Mt, "_");
      function $t() {
        return (r2[r2[62] >> 2] | 0) - (r2[3] | 0) >> 1 | 0;
      }
      f2($t, "ee");
      function Ut() {
        return R4[(r2[61] | 0) + 24 >> 0] | 0 | 0;
      }
      f2(Ut, "ae");
      function jt(t3) {
        t3 = t3 | 0, r2[3] = t3;
      }
      f2(jt, "re");
      function Dt() {
        return r2[(r2[61] | 0) + 28 >> 2] | 0;
      }
      f2(Dt, "ie");
      function Tt() {
        return (b3[803] | 0) != 0 | 0;
      }
      f2(Tt, "se");
      function Ft() {
        return (b3[804] | 0) != 0 | 0;
      }
      f2(Ft, "fe");
      function Wt() {
        return r2[68] | 0;
      }
      f2(Wt, "te");
      function Bt(t3) {
        return t3 = t3 | 0, E5 = t3 + 992 + 15 & -16, 992;
      }
      return f2(Bt, "ce"), { su: Bt, ai: Lt, e: Wt, ee: It, ele: vt, els: Et, es: $t, f: Ft, id: St, ie: Ot, ip: Ut, is: Mt, it: Dt, ms: Tt, p: N3, re: At, ri: Rt, sa: yt, se: _t, ses: jt, ss: Nt };
    })(typeof self < "u" ? self : global, {}, re2), ke2 = v2.su(Z2 - (2 << 17));
  }
  const i5 = _2.length + 1;
  v2.ses(ke2), v2.sa(i5 - 1), Fe2(_2, new Uint16Array(re2, ke2, i5)), v2.p() || (y = v2.e(), D());
  const o5 = [], c2 = [];
  for (; v2.ri(); ) {
    const u3 = v2.is(), p5 = v2.ie(), g2 = v2.ai(), b3 = v2.id(), d4 = v2.ss(), r2 = v2.se(), R4 = v2.it();
    let L2;
    v2.ip() && (L2 = ye2(b3 === -1 ? u3 : u3 + 1, _2.charCodeAt(b3 === -1 ? u3 - 1 : u3))), o5.push({ t: R4, n: L2, s: u3, e: p5, ss: d4, se: r2, d: b3, a: g2 });
  }
  for (; v2.re(); ) {
    const u3 = v2.es(), p5 = v2.ee(), g2 = v2.els(), b3 = v2.ele(), d4 = _2.charCodeAt(u3), r2 = g2 >= 0 ? _2.charCodeAt(g2) : -1;
    c2.push({ s: u3, e: p5, ls: g2, le: b3, n: d4 === 34 || d4 === 39 ? ye2(u3 + 1, d4) : _2.slice(u3, p5), ln: g2 < 0 ? void 0 : r2 === 34 || r2 === 39 ? ye2(g2 + 1, r2) : _2.slice(g2, b3) });
  }
  return [o5, c2, !!v2.f(), !!v2.ms()];
}
f2(fn, "parse");
function ye2(s4, e5) {
  y = s4;
  let n2 = "", i5 = y;
  for (; ; ) {
    y >= _2.length && D();
    const o5 = _2.charCodeAt(y);
    if (o5 === e5) break;
    o5 === 92 ? (n2 += _2.slice(i5, y), n2 += dn(), i5 = y) : (o5 === 8232 || o5 === 8233 || Be2(o5) && D(), ++y);
  }
  return n2 += _2.slice(i5, y++), n2;
}
f2(ye2, "b");
function dn() {
  let s4 = _2.charCodeAt(++y);
  switch (++y, s4) {
    case 110:
      return `
`;
    case 114:
      return "\r";
    case 120:
      return String.fromCharCode(Ce2(2));
    case 117:
      return (function() {
        const e5 = _2.charCodeAt(y);
        let n2;
        return e5 === 123 ? (++y, n2 = Ce2(_2.indexOf("}", y) - y), ++y, n2 > 1114111 && D()) : n2 = Ce2(4), n2 <= 65535 ? String.fromCharCode(n2) : (n2 -= 65536, String.fromCharCode(55296 + (n2 >> 10), 56320 + (1023 & n2)));
      })();
    case 116:
      return "	";
    case 98:
      return "\b";
    case 118:
      return "\v";
    case 102:
      return "\f";
    case 13:
      _2.charCodeAt(y) === 10 && ++y;
    case 10:
      return "";
    case 56:
    case 57:
      D();
    default:
      if (s4 >= 48 && s4 <= 55) {
        let e5 = _2.substr(y - 1, 3).match(/^[0-7]+/)[0], n2 = parseInt(e5, 8);
        return n2 > 255 && (e5 = e5.slice(0, -1), n2 = parseInt(e5, 8)), y += e5.length - 1, s4 = _2.charCodeAt(y), e5 === "0" && s4 !== 56 && s4 !== 57 || D(), String.fromCharCode(n2);
      }
      return Be2(s4) ? "" : String.fromCharCode(s4);
  }
}
f2(dn, "k");
function Ce2(s4) {
  const e5 = y;
  let n2 = 0, i5 = 0;
  for (let o5 = 0; o5 < s4; ++o5, ++y) {
    let c2, u3 = _2.charCodeAt(y);
    if (u3 !== 95) {
      if (u3 >= 97) c2 = u3 - 97 + 10;
      else if (u3 >= 65) c2 = u3 - 65 + 10;
      else {
        if (!(u3 >= 48 && u3 <= 57)) break;
        c2 = u3 - 48;
      }
      if (c2 >= 16) break;
      i5 = u3, n2 = 16 * n2 + c2;
    } else i5 !== 95 && o5 !== 0 || D(), i5 = u3;
  }
  return i5 !== 95 && y - e5 === s4 || D(), n2;
}
f2(Ce2, "l");
function Be2(s4) {
  return s4 === 13 || s4 === 10;
}
f2(Be2, "u");
function D() {
  throw Object.assign(Error(`Parse error ${We2}:${_2.slice(0, y).split(`
`).length}:${y - _2.lastIndexOf(`
`, y - 1)}`), { idx: y });
}
f2(D, "o");
var Se2;
typeof WebAssembly < "u" && (async () => {
  const { parse: s4, init: e5 } = await import("./lexer-DQCqS3nf-2QFX52XG.js");
  await e5, Se2 = s4;
})();
var Pe2 = f2((s4, e5) => Se2 ? Se2(s4, e5) : fn(s4, e5), "parseEsm");
var gn = f2((s4) => {
  if (!s4.includes("import") && !s4.includes("export")) return false;
  try {
    return Pe2(s4)[3];
  } catch {
    return true;
  }
}, "isESM");
var Je2 = "2";
var bn = ((s4) => {
  const e5 = "default";
  return s4[e5] && typeof s4[e5] == "object" && "__esModule" in s4[e5] ? s4[e5] : s4;
}).toString();
var pn = `.then(${bn})`;
var xe2 = f2((s4, e5, n2) => {
  if (n2) {
    if (!e5.includes("import(")) return;
  } else if (!e5.includes("import")) return;
  const o5 = Pe2(e5, s4)[0].filter((g2) => g2.d > -1);
  if (o5.length === 0) return;
  const c2 = new _e2(e5);
  for (const g2 of o5) c2.appendRight(g2.se, pn);
  const u3 = c2.toString(), p5 = c2.generateMap({ source: s4, includeContent: false, hires: "boundary" });
  return { code: u3, map: p5 };
}, "transformDynamicImport");
var Ge2 = f2((s4) => {
  try {
    const e5 = U.readFileSync(s4, "utf8");
    return JSON.parse(e5);
  } catch {
  }
}, "readJsonFile");
var qe2 = f2(() => {
}, "noop");
var ze2 = f2(() => Math.floor(Date.now() / 1e8), "getTime");
var wn = class extends Map {
  static {
    f2(this, "FileCache");
  }
  cacheDirectory = e;
  oldCacheDirectory = X2.join(Xt.tmpdir(), "tsx");
  cacheFiles;
  constructor() {
    super(), U.mkdirSync(this.cacheDirectory, { recursive: true }), this.cacheFiles = U.readdirSync(this.cacheDirectory).map((e5) => {
      const [n2, i5] = e5.split("-");
      return { time: Number(n2), key: i5, fileName: e5 };
    }), setImmediate(() => {
      this.expireDiskCache(), this.removeOldCacheDirectory();
    });
  }
  get(e5) {
    const n2 = super.get(e5);
    if (n2) return n2;
    const i5 = this.cacheFiles.find((u3) => u3.key === e5);
    if (!i5) return;
    const o5 = X2.join(this.cacheDirectory, i5.fileName), c2 = Ge2(o5);
    if (!c2) {
      U.promises.unlink(o5).then(() => {
        const u3 = this.cacheFiles.indexOf(i5);
        this.cacheFiles.splice(u3, 1);
      }, () => {
      });
      return;
    }
    return super.set(e5, c2), c2;
  }
  set(e5, n2) {
    if (super.set(e5, n2), n2) {
      const i5 = ze2();
      U.promises.writeFile(X2.join(this.cacheDirectory, `${i5}-${e5}`), JSON.stringify(n2)).catch(qe2);
    }
    return this;
  }
  expireDiskCache() {
    const e5 = ze2();
    for (const n2 of this.cacheFiles) e5 - n2.time > 7 && U.promises.unlink(X2.join(this.cacheDirectory, n2.fileName)).catch(qe2);
  }
  async removeOldCacheDirectory() {
    try {
      await U.promises.access(this.oldCacheDirectory).then(() => true) && ("rm" in U.promises ? await U.promises.rm(this.oldCacheDirectory, { recursive: true, force: true }) : await U.promises.rmdir(this.oldCacheDirectory, { recursive: true }));
    } catch {
    }
  }
};
var ie2 = process.env.TSX_DISABLE_CACHE ? /* @__PURE__ */ new Map() : new wn();
var mn = /^[\w+.-]+:\/\//;
var kn = /^([\w+.-]+:)\/\/([^@/#?]*@)?([^:/#?]*)(:\d+)?(\/[^#?]*)?(\?[^#]*)?(#.*)?/;
var yn = /^file:(?:\/\/((?![a-z]:)[^/#?]*)?)?(\/?[^#?]*)(\?[^#]*)?(#.*)?/i;
function Cn(s4) {
  return mn.test(s4);
}
f2(Cn, "isAbsoluteUrl");
function Sn(s4) {
  return s4.startsWith("//");
}
f2(Sn, "isSchemeRelativeUrl");
function He2(s4) {
  return s4.startsWith("/");
}
f2(He2, "isAbsolutePath");
function xn(s4) {
  return s4.startsWith("file:");
}
f2(xn, "isFileUrl");
function Xe2(s4) {
  return /^[.?#]/.test(s4);
}
f2(Xe2, "isRelative");
function se2(s4) {
  const e5 = kn.exec(s4);
  return Ke2(e5[1], e5[2] || "", e5[3], e5[4] || "", e5[5] || "/", e5[6] || "", e5[7] || "");
}
f2(se2, "parseAbsoluteUrl");
function vn(s4) {
  const e5 = yn.exec(s4), n2 = e5[2];
  return Ke2("file:", "", e5[1] || "", "", He2(n2) ? n2 : "/" + n2, e5[3] || "", e5[4] || "");
}
f2(vn, "parseFileUrl");
function Ke2(s4, e5, n2, i5, o5, c2, u3) {
  return { scheme: s4, user: e5, host: n2, port: i5, path: o5, query: c2, hash: u3, type: 7 };
}
f2(Ke2, "makeUrl");
function Ye2(s4) {
  if (Sn(s4)) {
    const n2 = se2("http:" + s4);
    return n2.scheme = "", n2.type = 6, n2;
  }
  if (He2(s4)) {
    const n2 = se2("http://foo.com" + s4);
    return n2.scheme = "", n2.host = "", n2.type = 5, n2;
  }
  if (xn(s4)) return vn(s4);
  if (Cn(s4)) return se2(s4);
  const e5 = se2("http://foo.com/" + s4);
  return e5.scheme = "", e5.host = "", e5.type = s4 ? s4.startsWith("?") ? 3 : s4.startsWith("#") ? 2 : 4 : 1, e5;
}
f2(Ye2, "parseUrl");
function _n(s4) {
  if (s4.endsWith("/..")) return s4;
  const e5 = s4.lastIndexOf("/");
  return s4.slice(0, e5 + 1);
}
f2(_n, "stripPathFilename");
function En(s4, e5) {
  Qe2(e5, e5.type), s4.path === "/" ? s4.path = e5.path : s4.path = _n(e5.path) + s4.path;
}
f2(En, "mergePaths");
function Qe2(s4, e5) {
  const n2 = e5 <= 4, i5 = s4.path.split("/");
  let o5 = 1, c2 = 0, u3 = false;
  for (let g2 = 1; g2 < i5.length; g2++) {
    const b3 = i5[g2];
    if (!b3) {
      u3 = true;
      continue;
    }
    if (u3 = false, b3 !== ".") {
      if (b3 === "..") {
        c2 ? (u3 = true, c2--, o5--) : n2 && (i5[o5++] = b3);
        continue;
      }
      i5[o5++] = b3, c2++;
    }
  }
  let p5 = "";
  for (let g2 = 1; g2 < o5; g2++) p5 += "/" + i5[g2];
  (!p5 || u3 && !p5.endsWith("/..")) && (p5 += "/"), s4.path = p5;
}
f2(Qe2, "normalizePath");
function Ln(s4, e5) {
  if (!s4 && !e5) return "";
  const n2 = Ye2(s4);
  let i5 = n2.type;
  if (e5 && i5 !== 7) {
    const c2 = Ye2(e5), u3 = c2.type;
    switch (i5) {
      case 1:
        n2.hash = c2.hash;
      case 2:
        n2.query = c2.query;
      case 3:
      case 4:
        En(n2, c2);
      case 5:
        n2.user = c2.user, n2.host = c2.host, n2.port = c2.port;
      case 6:
        n2.scheme = c2.scheme;
    }
    u3 > i5 && (i5 = u3);
  }
  Qe2(n2, i5);
  const o5 = n2.query + n2.hash;
  switch (i5) {
    case 2:
    case 3:
      return o5;
    case 4: {
      const c2 = n2.path.slice(1);
      return c2 ? Xe2(e5 || s4) && !Xe2(c2) ? "./" + c2 + o5 : c2 + o5 : o5 || ".";
    }
    case 5:
      return n2.path + o5;
    default:
      return n2.scheme + "//" + n2.user + n2.host + n2.port + n2.path + o5;
  }
}
f2(Ln, "resolve$1");
function Ze2(s4, e5) {
  return e5 && !e5.endsWith("/") && (e5 += "/"), Ln(s4, e5);
}
f2(Ze2, "resolve");
function On(s4) {
  if (!s4) return "";
  const e5 = s4.lastIndexOf("/");
  return s4.slice(0, e5 + 1);
}
f2(On, "stripFilename");
var F = 0;
function Rn(s4, e5) {
  const n2 = Ve2(s4, 0);
  if (n2 === s4.length) return s4;
  e5 || (s4 = s4.slice());
  for (let i5 = n2; i5 < s4.length; i5 = Ve2(s4, i5 + 1)) s4[i5] = Nn(s4[i5], e5);
  return s4;
}
f2(Rn, "maybeSort");
function Ve2(s4, e5) {
  for (let n2 = e5; n2 < s4.length; n2++) if (!An(s4[n2])) return n2;
  return s4.length;
}
f2(Ve2, "nextUnsortedSegmentLine");
function An(s4) {
  for (let e5 = 1; e5 < s4.length; e5++) if (s4[e5][F] < s4[e5 - 1][F]) return false;
  return true;
}
f2(An, "isSorted");
function Nn(s4, e5) {
  return e5 || (s4 = s4.slice()), s4.sort(In);
}
f2(Nn, "sortSegments");
function In(s4, e5) {
  return s4[F] - e5[F];
}
f2(In, "sortComparator");
var oe2 = false;
function Mn(s4, e5, n2, i5) {
  for (; n2 <= i5; ) {
    const o5 = n2 + (i5 - n2 >> 1), c2 = s4[o5][F] - e5;
    if (c2 === 0) return oe2 = true, o5;
    c2 < 0 ? n2 = o5 + 1 : i5 = o5 - 1;
  }
  return oe2 = false, n2 - 1;
}
f2(Mn, "binarySearch");
function $n(s4, e5, n2) {
  for (let i5 = n2 - 1; i5 >= 0 && s4[i5][F] === e5; n2 = i5--) ;
  return n2;
}
f2($n, "lowerBound");
function Un() {
  return { lastKey: -1, lastNeedle: -1, lastIndex: -1 };
}
f2(Un, "memoizedState");
function jn(s4, e5, n2, i5) {
  const { lastKey: o5, lastNeedle: c2, lastIndex: u3 } = n2;
  let p5 = 0, g2 = s4.length - 1;
  if (i5 === o5) {
    if (e5 === c2) return oe2 = u3 !== -1 && s4[u3][F] === e5, u3;
    e5 >= c2 ? p5 = u3 === -1 ? 0 : u3 : g2 = u3;
  }
  return n2.lastKey = i5, n2.lastNeedle = e5, n2.lastIndex = Mn(s4, e5, p5, g2);
}
f2(jn, "memoizedBinarySearch");
var et = class {
  static {
    f2(this, "TraceMap");
  }
  constructor(e5, n2) {
    const i5 = typeof e5 == "string";
    if (!i5 && e5._decodedMemo) return e5;
    const o5 = i5 ? JSON.parse(e5) : e5, { version: c2, file: u3, names: p5, sourceRoot: g2, sources: b3, sourcesContent: d4 } = o5;
    this.version = c2, this.file = u3, this.names = p5 || [], this.sourceRoot = g2, this.sources = b3, this.sourcesContent = d4, this.ignoreList = o5.ignoreList || o5.x_google_ignoreList || void 0;
    const r2 = Ze2(g2 || "", On(n2));
    this.resolvedSources = b3.map((L2) => Ze2(L2 || "", r2));
    const { mappings: R4 } = o5;
    typeof R4 == "string" ? (this._encoded = R4, this._decoded = void 0) : (this._encoded = void 0, this._decoded = Rn(R4, i5)), this._decodedMemo = Un(), this._bySources = void 0, this._bySourceMemos = void 0;
  }
};
function vr(s4) {
  return s4;
}
f2(vr, "cast$2");
function tt(s4) {
  var e5;
  return (e5 = s4)._decoded || (e5._decoded = Qt(s4._encoded));
}
f2(tt, "decodedMappings");
function Dn(s4, e5, n2) {
  const i5 = tt(s4);
  if (e5 >= i5.length) return null;
  const o5 = i5[e5], c2 = Tn(o5, s4._decodedMemo, e5, n2);
  return c2 === -1 ? null : o5[c2];
}
f2(Dn, "traceSegment");
function Tn(s4, e5, n2, i5, o5) {
  let c2 = jn(s4, i5, e5, n2);
  return oe2 && (c2 = $n(s4, i5, c2)), c2 === -1 || c2 === s4.length ? -1 : c2;
}
f2(Tn, "traceSegmentInternal");
var ve2 = class {
  static {
    f2(this, "SetArray");
  }
  constructor() {
    this._indexes = { __proto__: null }, this.array = [];
  }
};
function _r(s4) {
  return s4;
}
f2(_r, "cast$1");
function nt(s4, e5) {
  return s4._indexes[e5];
}
f2(nt, "get");
function V(s4, e5) {
  const n2 = nt(s4, e5);
  if (n2 !== void 0) return n2;
  const { array: i5, _indexes: o5 } = s4, c2 = i5.push(e5);
  return o5[e5] = c2 - 1;
}
f2(V, "put");
function Fn(s4, e5) {
  const n2 = nt(s4, e5);
  if (n2 === void 0) return;
  const { array: i5, _indexes: o5 } = s4;
  for (let c2 = n2 + 1; c2 < i5.length; c2++) {
    const u3 = i5[c2];
    i5[c2 - 1] = u3, o5[u3]--;
  }
  o5[e5] = void 0, i5.pop();
}
f2(Fn, "remove");
var Wn = 0;
var Bn = 1;
var Pn = 2;
var Jn = 3;
var Gn = 4;
var rt = -1;
var qn = class {
  static {
    f2(this, "GenMapping");
  }
  constructor({ file: e5, sourceRoot: n2 } = {}) {
    this._names = new ve2(), this._sources = new ve2(), this._sourcesContent = [], this._mappings = [], this.file = e5, this.sourceRoot = n2, this._ignoreList = new ve2();
  }
};
function Er(s4) {
  return s4;
}
f2(Er, "cast");
var zn = f2((s4, e5, n2, i5, o5, c2, u3, p5) => Yn(true, s4, e5, n2, i5, o5, c2, u3), "maybeAddSegment");
function Hn(s4, e5, n2) {
  const { _sources: i5, _sourcesContent: o5 } = s4, c2 = V(i5, e5);
  o5[c2] = n2;
}
f2(Hn, "setSourceContent");
function Xn(s4, e5, n2 = true) {
  const { _sources: i5, _sourcesContent: o5, _ignoreList: c2 } = s4, u3 = V(i5, e5);
  u3 === o5.length && (o5[u3] = null), n2 ? V(c2, u3) : Fn(c2, u3);
}
f2(Xn, "setIgnore");
function it(s4) {
  const { _mappings: e5, _sources: n2, _sourcesContent: i5, _names: o5, _ignoreList: c2 } = s4;
  return Vn(e5), { version: 3, file: s4.file || void 0, names: o5.array, sourceRoot: s4.sourceRoot || void 0, sources: n2.array, sourcesContent: i5, mappings: e5, ignoreList: c2.array };
}
f2(it, "toDecodedMap");
function Kn(s4) {
  const e5 = it(s4);
  return Object.assign(Object.assign({}, e5), { mappings: De2(e5.mappings) });
}
f2(Kn, "toEncodedMap");
function Yn(s4, e5, n2, i5, o5, c2, u3, p5, g2) {
  const { _mappings: b3, _sources: d4, _sourcesContent: r2, _names: R4 } = e5, L2 = Qn(b3, n2), E5 = Zn(L2, i5);
  if (!o5) return er(L2, E5) ? void 0 : st(L2, E5, [i5]);
  const N3 = V(d4, o5), $2 = p5 ? V(R4, p5) : rt;
  if (N3 === r2.length && (r2[N3] = null), !tr(L2, E5, N3, c2, u3, $2)) return st(L2, E5, p5 ? [i5, N3, c2, u3, $2] : [i5, N3, c2, u3]);
}
f2(Yn, "addSegmentInternal");
function Qn(s4, e5) {
  for (let n2 = s4.length; n2 <= e5; n2++) s4[n2] = [];
  return s4[e5];
}
f2(Qn, "getLine");
function Zn(s4, e5) {
  let n2 = s4.length;
  for (let i5 = n2 - 1; i5 >= 0; n2 = i5--) {
    const o5 = s4[i5];
    if (e5 >= o5[Wn]) break;
  }
  return n2;
}
f2(Zn, "getColumnIndex");
function st(s4, e5, n2) {
  for (let i5 = s4.length; i5 > e5; i5--) s4[i5] = s4[i5 - 1];
  s4[e5] = n2;
}
f2(st, "insert");
function Vn(s4) {
  const { length: e5 } = s4;
  let n2 = e5;
  for (let i5 = n2 - 1; i5 >= 0 && !(s4[i5].length > 0); n2 = i5, i5--) ;
  n2 < e5 && (s4.length = n2);
}
f2(Vn, "removeEmptyFinalLines");
function er(s4, e5) {
  return e5 === 0 ? true : s4[e5 - 1].length === 1;
}
f2(er, "skipSourceless");
function tr(s4, e5, n2, i5, o5, c2) {
  if (e5 === 0) return false;
  const u3 = s4[e5 - 1];
  return u3.length === 1 ? false : n2 === u3[Bn] && i5 === u3[Pn] && o5 === u3[Jn] && c2 === (u3.length === 5 ? u3[Gn] : rt);
}
f2(tr, "skipSource");
var ot = at("", -1, -1, "", null, false);
var nr = [];
function at(s4, e5, n2, i5, o5, c2) {
  return { source: s4, line: e5, column: n2, name: i5, content: o5, ignore: c2 };
}
f2(at, "SegmentObject");
function ct(s4, e5, n2, i5, o5) {
  return { map: s4, sources: e5, source: n2, content: i5, ignore: o5 };
}
f2(ct, "Source");
function ut(s4, e5) {
  return ct(s4, e5, "", null, false);
}
f2(ut, "MapSource");
function rr(s4, e5, n2) {
  return ct(null, nr, s4, e5, n2);
}
f2(rr, "OriginalSource");
function ir(s4) {
  const e5 = new qn({ file: s4.map.file }), { sources: n2, map: i5 } = s4, o5 = i5.names, c2 = tt(i5);
  for (let u3 = 0; u3 < c2.length; u3++) {
    const p5 = c2[u3];
    for (let g2 = 0; g2 < p5.length; g2++) {
      const b3 = p5[g2], d4 = b3[0];
      let r2 = ot;
      if (b3.length !== 1) {
        const G3 = n2[b3[1]];
        if (r2 = lt(G3, b3[2], b3[3], b3.length === 5 ? o5[b3[4]] : ""), r2 == null) continue;
      }
      const { column: R4, line: L2, name: E5, content: N3, source: $2, ignore: W } = r2;
      zn(e5, u3, d4, $2, L2, R4, E5), $2 && N3 != null && Hn(e5, $2, N3), W && Xn(e5, $2, true);
    }
  }
  return e5;
}
f2(ir, "traceMappings");
function lt(s4, e5, n2, i5) {
  if (!s4.map) return at(s4.source, e5, n2, i5, s4.content, s4.ignore);
  const o5 = Dn(s4.map, e5, n2);
  return o5 == null ? null : o5.length === 1 ? ot : lt(s4.sources[o5[1]], o5[2], o5[3], o5.length === 5 ? s4.map.names[o5[4]] : i5);
}
f2(lt, "originalPositionFor");
function sr(s4) {
  return Array.isArray(s4) ? s4 : [s4];
}
f2(sr, "asArray");
function or(s4, e5) {
  const n2 = sr(s4).map((c2) => new et(c2, "")), i5 = n2.pop();
  for (let c2 = 0; c2 < n2.length; c2++) if (n2[c2].sources.length > 1) throw new Error(`Transformation map ${c2} must have exactly one source file.
Did you specify these with the most recent transformation maps first?`);
  let o5 = ht(i5, e5, "", 0);
  for (let c2 = n2.length - 1; c2 >= 0; c2--) o5 = ut(n2[c2], [o5]);
  return o5;
}
f2(or, "buildSourceMapTree");
function ht(s4, e5, n2, i5) {
  const { resolvedSources: o5, sourcesContent: c2, ignoreList: u3 } = s4, p5 = i5 + 1, g2 = o5.map((b3, d4) => {
    const r2 = { importer: n2, depth: p5, source: b3 || "", content: void 0, ignore: void 0 }, R4 = e5(r2.source, r2), { source: L2, content: E5, ignore: N3 } = r2;
    if (R4) return ht(new et(R4, L2), e5, L2, p5);
    const $2 = E5 !== void 0 ? E5 : c2 ? c2[d4] : null, W = N3 !== void 0 ? N3 : u3 ? u3.includes(d4) : false;
    return rr(L2, $2, W);
  });
  return ut(s4, g2);
}
f2(ht, "build");
var ar = class {
  static {
    f2(this, "SourceMap");
  }
  constructor(e5, n2) {
    const i5 = n2.decodedMappings ? it(e5) : Kn(e5);
    this.version = i5.version, this.file = i5.file, this.mappings = i5.mappings, this.names = i5.names, this.ignoreList = i5.ignoreList, this.sourceRoot = i5.sourceRoot, this.sources = i5.sources, n2.excludeContent || (this.sourcesContent = i5.sourcesContent);
  }
  toString() {
    return JSON.stringify(this);
  }
};
function ft(s4, e5, n2) {
  const i5 = { excludeContent: !!n2, decodedMappings: false }, o5 = or(s4, e5);
  return new ar(ir(o5), i5);
}
f2(ft, "remapping");
var cr = f2((s4, e5, n2) => {
  const i5 = [], o5 = { code: e5 };
  for (const c2 of n2) {
    const u3 = c2(s4, o5.code);
    u3 && (Object.assign(o5, u3), i5.unshift(u3.map));
  }
  return { ...o5, map: ft(i5, () => null) };
}, "applyTransformersSync");
var ur = f2(async (s4, e5, n2) => {
  const i5 = [], o5 = { code: e5 };
  for (const c2 of n2) {
    const u3 = await c2(s4, o5.code);
    u3 && (Object.assign(o5, u3), i5.unshift(u3.map));
  }
  return { ...o5, map: ft(i5, () => null) };
}, "applyTransformers");
var lr = Object.freeze({ target: `node${process.versions.node}`, loader: "default" });
var hr = /^--inspect(?:-brk|-port|-publish-uid|-wait)?(?:=|$)/;
var fr = process.execArgv.some((s4) => hr.test(s4));
var dt = { ...lr, sourcemap: true, sourcesContent: !!process.env.NODE_V8_COVERAGE || fr, minifyWhitespace: true, keepNames: true };
var gt = f2((s4) => {
  const e5 = s4.sourcefile;
  if (e5) {
    const n2 = X2.extname(e5.split("?")[0]);
    n2 ? n2 === ".cts" || n2 === ".mts" ? s4.sourcefile = `${e5.slice(0, -3)}ts` : n2 === ".mjs" && (s4.sourcefile = `${e5.slice(0, -3)}js`) : s4.sourcefile += ".js";
  }
  return (n2) => (n2.map && (s4.sourcefile !== e5 && (n2.map = n2.map.replace(JSON.stringify(s4.sourcefile), JSON.stringify(e5))), n2.map = JSON.parse(n2.map)), n2);
}, "patchOptions");
var bt = f2((s4) => {
  throw s4.name = "TransformError", delete s4.errors, delete s4.warnings, s4;
}, "formatEsbuildError");
var dr = f2((s4, e5, n2) => {
  const i5 = {};
  let o5, c2, u3;
  if (e5.startsWith("file://")) {
    o5 = e5;
    const d4 = new URL(e5);
    c2 = Jt(d4);
  } else [c2, u3] = e5.split("?"), o5 = Gt(c2) + (u3 ? `?${u3}` : "");
  c2.endsWith(".cjs") || c2.endsWith(".cts") || (i5["import.meta.url"] = JSON.stringify(o5));
  const p5 = { ...dt, format: "cjs", sourcefile: c2, define: i5, banner: `__filename=${JSON.stringify(c2)};(()=>{`, footer: "})()", platform: "node", ...n2 }, g2 = Ne2([s4, JSON.stringify(p5), import_esbuild.version, Je2].join("-"));
  let b3 = ie2.get(g2);
  return b3 || (b3 = cr(e5, s4, [(d4, r2) => {
    const R4 = gt(p5);
    let L2;
    try {
      L2 = (0, import_esbuild.transformSync)(r2, p5);
    } catch (E5) {
      throw bt(E5);
    }
    return R4(L2);
  }, (d4, r2) => xe2(d4, r2, true)]), ie2.set(g2, b3)), b3;
}, "transformSync");
var gr = f2(async (s4, e5, n2) => {
  const i5 = { ...dt, format: "esm", sourcefile: e5, ...n2 }, o5 = Ne2([s4, JSON.stringify(i5), import_esbuild.version, Je2].join("-"));
  let c2 = ie2.get(o5);
  return c2 || (c2 = await ur(e5, s4, [async (u3, p5) => {
    const g2 = gt(i5);
    let b3;
    try {
      b3 = await (0, import_esbuild.transform)(p5, i5);
    } catch (d4) {
      throw bt(d4);
    }
    return g2(b3);
  }, (u3, p5) => xe2(u3, p5, true)]), ie2.set(o5, c2)), c2;
}, "transform");

// node_modules/tsx/dist/client-BQVF1NaW.mjs
import p3 from "net";
var a3 = Object.defineProperty;
var o3 = (e5, n2) => a3(e5, "name", { value: n2, configurable: true });
var m4 = o3(() => new Promise((e5) => {
  const n2 = n(process.ppid), t3 = p3.createConnection(n2, () => {
    e5(o3((i5) => {
      const r2 = Buffer.from(JSON.stringify(i5)), s4 = Buffer.alloc(4);
      s4.writeInt32BE(r2.length, 0), t3.write(Buffer.concat([s4, r2]));
    }, "sendToParent"));
  });
  t3.on("error", () => {
    e5();
  }), t3.unref();
}), "connectToServer");
var c = { send: void 0 };
var f3 = m4();
f3.then((e5) => {
  c.send = e5;
}, () => {
});

// node_modules/tsx/dist/register-CFH5oNdT.mjs
import { inspect as oe3 } from "util";

// node_modules/tsx/dist/index-gbaejti9.mjs
var u2 = Object.defineProperty;
var g = (s4, n2) => u2(s4, "name", { value: n2, configurable: true });
var t2 = true;
var l = typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {};
var i3 = 0;
if (l.process && l.process.env && l.process.stdout) {
  const { FORCE_COLOR: s4, NODE_DISABLE_COLORS: n2, NO_COLOR: r2, TERM: o5, COLORTERM: c2 } = l.process.env;
  n2 || r2 || s4 === "0" ? t2 = false : s4 === "1" || s4 === "2" || s4 === "3" ? t2 = true : o5 === "dumb" ? t2 = false : "CI" in l.process.env && ["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE", "DRONE"].some((a5) => a5 in l.process.env) ? t2 = true : t2 = process.stdout.isTTY, t2 && (process.platform === "win32" || c2 && (c2 === "truecolor" || c2 === "24bit") ? i3 = 3 : o5 && (o5.endsWith("-256color") || o5.endsWith("256")) ? i3 = 2 : i3 = 1);
}
var f4 = { enabled: t2, supportLevel: i3 };
function e3(s4, n2, r2 = 1) {
  const o5 = `\x1B[${s4}m`, c2 = `\x1B[${n2}m`, a5 = new RegExp(`\\x1b\\[${n2}m`, "g");
  return (p5) => f4.enabled && f4.supportLevel >= r2 ? o5 + ("" + p5).replace(a5, o5) + c2 : "" + p5;
}
g(e3, "kolorist");
var b = e3(30, 39);
var d2 = e3(33, 39);
var O3 = e3(90, 39);
var C2 = e3(92, 39);
var R2 = e3(95, 39);
var I3 = e3(96, 39);
var L = e3(44, 49);
var E3 = e3(100, 49);
var T = e3(103, 49);

// node_modules/tsx/dist/register-CFH5oNdT.mjs
var K3 = Object.defineProperty;
var o4 = (s4, e5) => K3(s4, "name", { value: e5, configurable: true });
var R3 = o4((s4) => {
  if (!s4.startsWith("data:text/javascript,")) return;
  const e5 = s4.indexOf("?");
  if (e5 === -1) return;
  const n2 = new URLSearchParams(s4.slice(e5 + 1)).get("filePath");
  if (n2) return n2;
}, "getOriginalFilePath");
var D2 = o4((s4) => {
  const e5 = R3(s4);
  return e5 && (d3._cache[e5] = d3._cache[s4], delete d3._cache[s4], s4 = e5), s4;
}, "interopCjsExports");
var me3 = o4((s4) => {
  const e5 = s4.indexOf(":");
  if (e5 !== -1) return s4.slice(0, e5);
}, "getScheme");
var N2 = o4((s4) => s4[0] === "." && (s4[1] === "/" || s4[1] === "." || s4[2] === "/"), "isRelativePath");
var j = o4((s4) => N2(s4) || p4.isAbsolute(s4), "isFilePath");
var pe2 = o4((s4) => {
  if (j(s4)) return true;
  const e5 = me3(s4);
  return e5 && e5 !== "node";
}, "requestAcceptsQuery");
var y2 = "file://";
var C3 = /\.([cm]?ts|[tj]sx)($|\?)/;
var E4 = /\/(?:$|\?)/;
var Q3 = `${p4.sep}node_modules${p4.sep}`;
var M;
var _3;
var S = false;
var A2 = o4((s4) => {
  let e5 = null;
  if (s4) {
    const a5 = p4.resolve(s4);
    e5 = { path: a5, config: pe(a5) };
  } else {
    try {
      e5 = Ge();
    } catch {
    }
    if (!e5) return;
  }
  M = sn(e5), _3 = Ze(e5), S = e5?.config.compilerOptions?.allowJs ?? false;
}, "loadTsconfig");
var T2 = o4((s4) => Array.from(s4).length > 0 ? `?${s4.toString()}` : "", "urlSearchParamsStringify");
var Pe3 = `
//# sourceMappingURL=data:application/json;base64,`;
var I4 = o4(() => process.sourceMapsEnabled ?? true, "shouldApplySourceMap");
var F2 = o4(({ code: s4, map: e5 }) => s4 + Pe3 + Buffer.from(JSON.stringify(e5), "utf8").toString("base64"), "inlineSourceMap");
var v3 = Number(process.env.TSX_DEBUG);
v3 && (f4.enabled = true, f4.supportLevel = 3);
var J3 = o4((s4) => (e5, ...a5) => {
  if (!v3 || e5 > v3) return;
  const n2 = `${E3(` tsx P${process.pid} `)} ${s4}`, t3 = a5.map((r2) => typeof r2 == "string" ? r2 : oe3(r2, { colors: true })).join(" ");
  te2(1, `${n2} ${t3}
`);
}, "createLog");
var P2 = J3(T(b(" CJS ")));
var je3 = J3(L(" ESM "));
var be2 = [".cts", ".mts", ".ts", ".tsx", ".jsx"];
var xe3 = [".js", ".cjs", ".mjs"];
var k = [".ts", ".tsx", ".jsx"];
var $ = o4((s4, e5, a5, n2) => {
  const t3 = Object.getOwnPropertyDescriptor(s4, e5);
  t3?.set ? s4[e5] = a5 : (!t3 || t3.configurable) && Object.defineProperty(s4, e5, { value: a5, enumerable: t3?.enumerable || n2?.enumerable, writable: n2?.writable ?? (t3 ? t3.writable : true), configurable: n2?.configurable ?? (t3 ? t3.configurable : true) });
}, "safeSet");
var ye3 = o4((s4, e5, a5) => {
  const n2 = e5[".js"], t3 = o4((r2, c2) => {
    if (s4.enabled === false) return n2(r2, c2);
    const [i5, f5] = c2.split("?");
    if ((new URLSearchParams(f5).get("namespace") ?? void 0) !== a5) return n2(r2, c2);
    P2(2, "load", { filePath: c2 }), r2.id.startsWith("data:text/javascript,") && (r2.path = p4.dirname(i5)), c?.send && c.send({ type: "dependency", path: i5 });
    const u3 = be2.some((m6) => i5.endsWith(m6)), g2 = xe3.some((m6) => i5.endsWith(m6));
    if (!u3 && !g2) return n2(r2, i5);
    let h3 = se3.readFileSync(i5, "utf8");
    if (i5.endsWith(".cjs")) {
      const m6 = xe2(c2, h3);
      m6 && (h3 = I4() ? F2(m6) : m6.code);
    } else if (u3 || gn(h3)) {
      const m6 = dr(h3, c2, { tsconfigRaw: M?.(i5) });
      h3 = I4() ? F2(m6) : m6.code;
    }
    P2(1, "loaded", { filePath: i5 }), r2._compile(h3, i5);
  }, "transformer");
  $(e5, ".js", t3);
  for (const r2 of k) $(e5, r2, t3, { enumerable: !a5, writable: true, configurable: true });
  return $(e5, ".mjs", t3, { writable: true, configurable: true }), () => {
    e5[".js"] === t3 && (e5[".js"] = n2);
    for (const r2 of [...k, ".mjs"]) e5[r2] === t3 && delete e5[r2];
  };
}, "createExtensions");
var Ee = o4((s4) => (e5) => {
  if ((e5 === "." || e5 === ".." || e5.endsWith("/..")) && (e5 += "/"), E4.test(e5)) {
    let a5 = p4.join(e5, "index.js");
    e5.startsWith("./") && (a5 = `./${a5}`);
    try {
      return s4(a5);
    } catch {
    }
  }
  try {
    return s4(e5);
  } catch (a5) {
    const n2 = a5;
    if (n2.code === "MODULE_NOT_FOUND") try {
      return s4(`${e5}${p4.sep}index.js`);
    } catch {
    }
    throw n2;
  }
}, "createImplicitResolver");
var B = [".js", ".json"];
var G2 = [".ts", ".tsx", ".jsx"];
var _e3 = [...G2, ...B];
var Se3 = [...B, ...G2];
var b2 = /* @__PURE__ */ Object.create(null);
b2[".js"] = [".ts", ".tsx", ".js", ".jsx"], b2[".jsx"] = [".tsx", ".ts", ".jsx", ".js"], b2[".cjs"] = [".cts"], b2[".mjs"] = [".mts"];
var X3 = o4((s4) => {
  const e5 = s4.split("?"), a5 = e5[1] ? `?${e5[1]}` : "", [n2] = e5, t3 = p4.extname(n2), r2 = [], c2 = b2[t3];
  if (c2) {
    const f5 = n2.slice(0, -t3.length);
    r2.push(...c2.map((l2) => f5 + l2 + a5));
  }
  const i5 = !(s4.startsWith(y2) || j(n2)) || n2.includes(Q3) || n2.includes("/node_modules/") ? Se3 : _e3;
  return r2.push(...i5.map((f5) => n2 + f5 + a5)), r2;
}, "mapTsExtensions");
var w2 = o4((s4, e5, a5) => {
  if (P2(3, "resolveTsFilename", { request: e5, isDirectory: E4.test(e5), isTsParent: a5, allowJs: S }), E4.test(e5) || !a5 && !S) return;
  const n2 = X3(e5);
  if (n2) for (const t3 of n2) try {
    return s4(t3);
  } catch (r2) {
    const { code: c2 } = r2;
    if (c2 !== "MODULE_NOT_FOUND" && c2 !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw r2;
  }
}, "resolveTsFilename");
var ve3 = o4((s4, e5) => (a5) => {
  if (P2(3, "resolveTsFilename", { request: a5, isTsParent: e5, isFilePath: j(a5) }), j(a5)) {
    const n2 = w2(s4, a5, e5);
    if (n2) return n2;
  }
  try {
    return s4(a5);
  } catch (n2) {
    const t3 = n2;
    if (t3.code === "MODULE_NOT_FOUND") {
      if (t3.path) {
        const c2 = t3.message.match(/^Cannot find module '([^']+)'$/);
        if (c2) {
          const f5 = c2[1], l2 = w2(s4, f5, e5);
          if (l2) return l2;
        }
        const i5 = t3.message.match(/^Cannot find module '([^']+)'. Please verify that the package.json has a valid "main" entry$/);
        if (i5) {
          const f5 = i5[1], l2 = w2(s4, f5, e5);
          if (l2) return l2;
        }
      }
      const r2 = w2(s4, a5, e5);
      if (r2) return r2;
    }
    throw t3;
  }
}, "createTsExtensionResolver");
var z = "at cjsPreparseModuleExports (node:internal";
var we2 = o4((s4) => {
  const e5 = s4.stack.split(`
`).slice(1);
  return e5[1].includes(z) || e5[2].includes(z);
}, "isFromCjsLexer");
var Me3 = o4((s4, e5) => {
  const a5 = s4.split("?"), n2 = new URLSearchParams(a5[1]);
  if (e5?.filename) {
    const t3 = R3(e5.filename);
    let r2;
    if (t3) {
      const f5 = t3.split("?"), l2 = f5[0];
      r2 = f5[1], e5.filename = l2, e5.path = p4.dirname(l2), e5.paths = d3._nodeModulePaths(e5.path), d3._cache[l2] = e5;
    }
    r2 || (r2 = e5.filename.split("?")[1]);
    const i5 = new URLSearchParams(r2).get("namespace");
    i5 && n2.append("namespace", i5);
  }
  return [a5[0], n2, (t3, r2) => (p4.isAbsolute(t3) && !t3.endsWith(".json") && !t3.endsWith(".node") && !(r2 === 0 && we2(new Error())) && (t3 += T2(n2)), t3)];
}, "preserveQuery");
var Te3 = o4((s4, e5, a5) => {
  if (s4.startsWith(y2) && (s4 = O4(s4)), _3 && !j(s4) && !e5?.filename?.includes(Q3)) {
    const n2 = _3(s4);
    for (const t3 of n2) try {
      return a5(t3);
    } catch {
    }
  }
  return a5(s4);
}, "resolveTsPaths");
var Fe3 = o4((s4, e5, a5) => (n2, t3, ...r2) => {
  if (s4.enabled === false) return e5(n2, t3, ...r2);
  n2 = D2(n2);
  const [c2, i5, f5] = Me3(n2, t3);
  if ((i5.get("namespace") ?? void 0) !== a5) return e5(n2, t3, ...r2);
  P2(2, "resolve", { request: n2, parent: t3?.filename ?? t3, restOfArgs: r2 });
  let l2 = o4((g2) => e5(g2, t3, ...r2), "nextResolveSimple");
  l2 = ve3(l2, !!(a5 || t3?.filename && C3.test(t3.filename))), l2 = Ee(l2);
  const u3 = f5(Te3(c2, t3, l2), r2.length);
  return P2(1, "resolved", { request: n2, parent: t3?.filename ?? t3, resolved: u3 }), u3;
}, "createResolveFilename");
var H2 = o4((s4, e5) => {
  if (!e5) throw new Error("The current file path (__filename or import.meta.url) must be provided in the second argument of tsx.require()");
  return s4.startsWith(".") ? ((typeof e5 == "string" && e5.startsWith(y2) || e5 instanceof URL) && (e5 = O4(e5)), p4.resolve(p4.dirname(e5), s4)) : s4;
}, "resolveContext");
var $e3 = o4((s4) => {
  const { sourceMapsEnabled: e5 } = process, a5 = { enabled: true };
  A2(process.env.TSX_TSCONFIG_PATH), process.setSourceMapsEnabled(true);
  const n2 = d3._resolveFilename, t3 = Fe3(a5, n2, s4?.namespace);
  d3._resolveFilename = t3;
  const r2 = ye3(a5, d3._extensions, s4?.namespace), c2 = o4(() => {
    e5 === false && process.setSourceMapsEnabled(false), a5.enabled = false, d3._resolveFilename === t3 && (d3._resolveFilename = n2), r2();
  }, "unregister");
  if (s4?.namespace) {
    const i5 = o4((l2, u3) => {
      const g2 = H2(l2, u3), [h3, m6] = g2.split("?"), x = new URLSearchParams(m6);
      return s4.namespace && !h3.startsWith("node:") && x.set("namespace", s4.namespace), m(h3 + T2(x));
    }, "scopedRequire");
    c2.require = i5;
    const f5 = o4((l2, u3, g2) => {
      const h3 = H2(l2, u3), [m6, x] = h3.split("?"), L2 = new URLSearchParams(x);
      return s4.namespace && !m6.startsWith("node:") && L2.set("namespace", s4.namespace), t3(m6 + T2(L2), module, false, g2);
    }, "scopedResolve");
    c2.resolve = f5, c2.unregister = c2;
  }
  return c2;
}, "register");

// node_modules/tsx/dist/require-DQxpCAr4.mjs
var m5 = Object.defineProperty;
var a4 = (r2, t3) => m5(r2, "name", { value: t3, configurable: true });
var e4;
var s3 = a4((r2, t3) => (e4 || (e4 = $e3({ namespace: Date.now().toString() })), e4.require(r2, t3)), "tsxRequire");
var i4 = a4((r2, t3, c2) => (e4 || (e4 = $e3({ namespace: Date.now().toString() })), e4.resolve(r2, t3, c2)), "resolve");
i4.paths = m.resolve.paths, s3.resolve = i4, s3.main = m.main, s3.extensions = m.extensions, s3.cache = m.cache;

// node_modules/tsx/dist/cjs/api/index.mjs
import "path";
import "os";
import "module";
import "url";
import "fs";
var import_esbuild2 = __toESM(require_main(), 1);
import "crypto";
import "net";
import "util";
export {
  $e3 as register,
  s3 as require
};
