import qs from 'qs'
import xss from 'xss'
import buddy from 'koa-body'
import { join, dirname } from 'path'
import { deflateSync } from 'zlib';

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
            context.getParameter = function (key, isXSS = true) {
                return handler.call(this, key, false, isXSS)
            }
        }

        if (!context.getParameters) {
            context.getParameters = function (key, isXSS = true) {
                return handler.call(this, key, true, isXSS)
            }
        }

        await body(ctx, next)
    }
}

function handler(key, multiple, isXSS) {
    let value = ''

    if (this.idempotent && this.querystring) {
        let query = qs.parse(this.querystring)

        value = key.includes('.') ? destruction(query, key) : query[key]
    } else if (this.request.body) {
        if (this.is('multipart')) {
            Object.assign(this.request.body, this.request.body.fields, this.request.body.files)
        }

        value = key.includes('.') ? destruction(this.request.body, key) : this.request.body[key]
    }
    
    if (!value) {
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

function destruction(obj, key) {
    for (key of key.split('.')) {
        if (!(obj = obj[key])) {
            break
        }
    }

    return obj
}

function isArray(val) {
    return Array.isArray(val)
}

function isString(val) {
    return typeof val === 'string'
}

function isObject(val) {
    return typeof val === 'object' && !isArray(val)
}