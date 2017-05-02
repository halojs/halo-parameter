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

    return function* _parameter(next) {
        let ctx = this.app.context
        
        if (!ctx.getParameter) {
            ctx.getParameter = function (key, isXSS = true) {
                return handler.call(this, key, false, isXSS)
            }
        }

        if (!ctx.getParameters) {
            ctx.getParameters = function (key, isXSS = true) {
                return handler.call(this, key, true, isXSS)
            }
        }
        
        yield* body.call(this, next)
    }
}

function handler(key, multiple, isXSS) {
    let value = ''
    
    if (this.idempotent && this.querystring) {
        let query = queryCache[this.querystring]
        
        if (!query) {
            query = queryCache[this.querystring] = converter(qs.parse(this.querystring))
        }

        value = query[key]
    } else if (this.request.body) {
        if (this.is('multipart')) {
            Object.assign(this.request.body, this.request.body.fields, this.request.body.files)
        }
        
        value = this.request.body[key]
    }
    
    if (['', undefined, null].includes(value)) {
        return multiple ? [] : ''
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

    return val
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