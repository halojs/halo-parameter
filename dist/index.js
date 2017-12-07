'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (options = {}) {
    let body = (0, _koaBody2.default)({
        multipart: true,
        jsonLimit: options.jsonLimit,
        formLimit: options.formLimit,
        textLimit: options.textLimit,
        formidable: {
            maxFields: options.maxFields,
            maxFieldsSize: options.maxFieldsSize,
            onFileBegin(name, file) {
                file.path = (0, _path.join)((0, _path.dirname)(file.path), file.name);
            }
        }
    });

    return async function _parameter(ctx, next) {
        let context = ctx.app.context;

        if (!context.getParameter) {
            context.getParameter = function (key, isXSS = true) {
                return handler.call(this, key, false, isXSS);
            };
        }

        if (!context.getParameters) {
            context.getParameters = function (key, isXSS = true) {
                return handler.call(this, key, true, isXSS);
            };
        }

        await body(ctx, next);
    };
};

var _qs = require('qs');

var _qs2 = _interopRequireDefault(_qs);

var _xss = require('xss');

var _xss2 = _interopRequireDefault(_xss);

var _koaBody = require('koa-body');

var _koaBody2 = _interopRequireDefault(_koaBody);

var _path = require('path');

var _zlib = require('zlib');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function handler(key, multiple, isXSS) {
    let value = '';

    if (this.idempotent && this.querystring) {
        let query = _qs2.default.parse(this.querystring);

        value = key.includes('.') ? destruction(query, key) : query[key];
    } else if (this.request.body) {
        if (this.is('multipart')) {
            Object.assign(this.request.body, this.request.body.fields, this.request.body.files);
        }

        value = key.includes('.') ? destruction(this.request.body, key) : this.request.body[key];
    }

    if (!value) {
        return multiple ? [] : '';
    }

    if (multiple) {
        value = isArray(value) ? value : [value];
    } else {
        value = isArray(value) ? value[0] : value;
    }

    if (isXSS) {
        value = this.request.body.files && this.request.body.files[key] ? value : filterXSS(value);
    }

    return value;
}

function filterXSS(val) {
    if (isArray(val)) {
        return val.map(item => filterXSS(item));
    }

    if (isObject(val)) {
        return Object.keys(val).reduce((total, value) => {
            return total[value] = filterXSS(val[value]), total;
        }, {});
    }

    return isString(val) ? (0, _xss2.default)(val) : val;
}

function destruction(obj, key) {
    for (key of key.split('.')) {
        if (!(obj = obj[key])) {
            break;
        }
    }

    return obj;
}

function isArray(val) {
    return Array.isArray(val);
}

function isString(val) {
    return typeof val === 'string';
}

function isObject(val) {
    return typeof val === 'object' && !isArray(val);
}