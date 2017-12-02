import qs from 'qs'
import xss from 'xss'
import buddy from 'koa-body'
import { join, dirname } from 'path'

let queryCache = {}

export default function (options = {}) {
    let body = buddy({
        multipart: true,
        jsonLimit: options.jsonLimit,
        formLimit: options.formLimit,
        textLimit: options.textLimit,
        formidable: {
            maxFields: options.maxFields,
            maxFieldsSize: options.maxFieldsSize,
            onFileBegin(name, file) {
                file.path = join(dirname(file.path), file.name)
            }
        }
    })

    return async function _parameter(ctx, next) {
        let context = ctx.app.context
        
        if (!context.getParameter) {
            context.getParameter = function (key, defaultValue, isXSS = true) {
                return handler.call(this, key, defaultValue, false, isXSS)
            }
        }

        if (!context.getParameters) {
            context.getParameters = function (key, defaultValue, isXSS = true) {
                return handler.call(this, key, defaultValue, true, isXSS)
            }
        }

        await body(ctx, next)
    }
}

function handler(key, defaultValue, multiple, isXSS) {
    let value = ''

    if (this.idempotent && this.querystring) {
        let query = queryCache[this.querystring]
        
        if (!query) {
            query = queryCache[this.querystring] = converter(qs.parse(this.querystring))
        }

        value = key.includes('.') ? destruction(query, key) : query[key]
    } else if (this.request.body) {
        if (this.is('multipart')) {
            Object.assign(this.request.body, this.request.body.fields, this.request.body.files)
        }
        
        value = key.includes('.') ? destruction(this.request.body, key) : this.request.body[key]
    }

    if (!value && defaultValue) {
        value = converter(defaultValue)
    }

    if (!value && value !== false && value !== 0) {
        return value
    }

    if (multiple) {
        value = isArray(value) ? value : [value]
    } else {
        value = isArray(value) ? value[0] : value
    }
    
    if (isXSS) {
        value = this.request.body.files && this.request.body.files[key] ? value : filterXSS(value)
    }

    return value
}

function filterXSS(val) {
    if (isArray(val)) {
        return val.map((item) => filterXSS(item))
    }

    if (isObject(val)) {
        return Object.keys(val).reduce((total, value) => {
            return total[value] = filterXSS(val[value]), total
        }, {})
    }

    return isString(val) ? xss(val) : val
}

function converter(val) {
    if (isNumeric(val)) {
        return +val
    }

    if (isBoolean(val)) {
        return val === 'true' ? true : false
    }
    
    if (isArray(val)) {
        return val.map((item) => converter(item))
    }

    if (isObject(val)) {
        return Object.keys(val).reduce((total, value) => {
            return total[value] = converter(val[value]), total
        }, {})
    }

    if (isArrayStr(val) || isObjectStr(val)) {
        return converter(JSON.parse(val))
    }

    return val
}

function destruction(obj, key) {
    for (key of key.split('.')) {
        if (!(obj = obj[key])) {
            break
        }
    }

    return obj
}

function isNumeric(val) {
    return !isNaN(val)
}

function isArray(val) {
    return Array.isArray(val)
}

function isString(val) {
    return typeof val === 'string'
}

function isBoolean(val) {
    return val === 'true' || val === 'false'
}

function isObject(val) {
    return typeof val === 'object' && !isArray(val)
}

function isArrayStr(val) {
    return val.indexOf('[') === 0 && val.lastIndexOf(']') === val.length - 1
}

function isObjectStr(val) {
    return val.indexOf('{') === 0 && val.lastIndexOf('}') === val.length - 1
}