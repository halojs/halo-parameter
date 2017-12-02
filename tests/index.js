import fs from 'fs'
import koa from 'koa'
import test from 'ava'
import { join } from 'path'
import request from 'request'
import mount from 'koa-mount'
import parameter from '../src'

const req = request.defaults({
    json: true,
    baseUrl: 'http://localhost:3000'
})

test.before.cb((t) => {
    let app = new koa()
    
    app.use(parameter())
    app.use(mount('/parameter', async function(ctx, next) {
        ctx.body = {
            data: ctx.getParameter('a', '', ctx.getParameter('xss') === false ? false : true)
        }
    }))
    app.use(mount('/parameters', async function(ctx, next) {
        ctx.body = {
            data: ctx.getParameters('a', '', ctx.getParameter('xss') === false ? false : true)
        }
    }))
    app.use(mount('/destruction_parameter', async function(ctx, next) {
        ctx.body = {
            data: ctx.getParameter('a.b')
        }
    }))
    app.use(mount('/default_parameter', async function(ctx, next) {
        if (ctx.getParameter('multiple')) {
            ctx.body = {
                number: ctx.getParameters('a', '10'),
                string: ctx.getParameters('a', 'test'),
                boolean: ctx.getParameters('a', 'false'),
                array: ctx.getParameters('a', '[1, 2, 3]'),
                obj: ctx.getParameters('a', '{ "key": "value" }')
            }
        } else {
            ctx.body = {
                number: ctx.getParameter('a', '10'),
                string: ctx.getParameter('a', 'test'),
                boolean: ctx.getParameter('a', 'false'),
                array: ctx.getParameter('a', '[1, 2, 3]'),
                obj: ctx.getParameter('a', '{ "key": "value" }')
            }
        }
    }))
    app.listen(3000, t.end)
})

test.cb('no parameters, use getParameter method', (t) => {
    req.get('/parameter', (err, res, body) => {
        t.is(body.data, undefined)
        t.end()
    })
})

test.cb('no parameters, use getParameters method', (t) => {
    req.get('/parameters', (err, res, body) => {
        t.deepEqual(body.data, undefined)
        t.end()
    })
})

test.cb('one parameters, use getParameter method', (t) => {
    req.get('/parameter?a=1', (err, res, body) => {
        t.is(body.data, 1)
        t.end()
    })
})

test.cb('one parameters, use getParameters method', (t) => {
    req.get('/parameters?a=1', (err, res, body) => {
        t.deepEqual(body.data, [1])
        t.end()
    })
})

test.cb('multiple parameters, use getParameter method', (t) => {
    req.get('/parameter?a[]=1&a[]=2&a[]=3', (err, res, body) => {
        t.is(body.data, 1)
        t.end()
    })
})

test.cb('multiple parameters, use getParameters method', (t) => {
    req.get('/parameters?a[]=1&a[]=2&a[]=3', (err, res, body) => {
        t.deepEqual(body.data, [1, 2, 3])
        t.end()
    })
})

test.cb('filter xss, use getParameter method', (t) => {
    req.get('/parameter?a=<script>alert("xss")</script>', (err, res, body) => {
        t.is(body.data, '&lt;script&gt;alert("xss")&lt;/script&gt;')
        t.end()
    })
})

test.cb('filter xss, use getParameters method', (t) => {
    req.get('/parameters?a=<script>alert("xss")</script>', (err, res, body) => {
        t.deepEqual(body.data, ['&lt;script&gt;alert("xss")&lt;/script&gt;'])
        t.end()
    })
})

test.cb('no filter xss, use getParameter method', (t) => {
    req.get('/parameter?a=<script>alert("xss")</script>&xss=false', (err, res, body) => {
        t.is(body.data, '<script>alert("xss")</script>')
        t.end()
    })
})

test.cb('no filter xss, use getParameters method', (t) => {
    req.get('/parameters?a=<script>alert("xss")</script>&xss=false', (err, res, body) => {
        t.deepEqual(body.data, ['<script>alert("xss")</script>'])
        t.end()
    })
})

test.cb('special parameters, use getParameter method', (t) => {
    req.get('/parameter?a=~!@#$%^^&&(())', (err, res, body) => {
        t.not(body.data, '~!@#$%^^&&(())')
        t.end()
    })
})

test.cb('special parameters, use getParameters method', (t) => {
    req.get('/parameters?a=~!@#$%^^&&(())', (err, res, body) => {
        t.not(body.data, ['~!@#$%^^&&(())'])
        t.end()
    })
})

test.cb('not through the url transfer parameters, use getParameter method', (t) => {
    req.get('/parameter', { qs: { a: { num: 1 } } }, (err, res, body) => {
        t.is(body.data.num, 1)
        t.end()
    })
})

test.cb('not through the url transfer parameters, use getParameters method', (t) => {
    req.get('/parameters', { qs: { a: { num: 1 } } }, (err, res, body) => {
        t.deepEqual(body.data, [{num: 1}])
        t.end()
    })
})

test.cb('no parameters, use getParameter method, in POST', (t) => {
    req.post('/parameter', (err, res, body) => {
        t.is(body.data, undefined)
        t.end()
    })
})

test.cb('no parameters, use getParameters method, in POST', (t) => {
    req.post('/parameters', (err, res, body) => {
        t.deepEqual(body.data, undefined)
        t.end()
    })
})

test.cb('one parameters, use getParameter method, in POST', (t) => {
    req.post('/parameter', {
        body: {
            a: 1
        }
    }, (err, res, body) => {
        t.is(body.data, 1)
        t.end()
    })
})

test.cb('one parameters, use getParameters method, in POST', (t) => {
    req.post('/parameters', {
        body: {
            a: 1
        }
    }, (err, res, body) => {
        t.deepEqual(body.data, [1])
        t.end()
    })
})

test.cb('filter xss, use getParameter method, in POST', (t) => {
    req.post('/parameter', {
        body: {
            a: '<script>alert("xss")</script>'
        }
    }, (err, res, body) => {
        t.is(body.data, '&lt;script&gt;alert("xss")&lt;/script&gt;')
        t.end()
    })
})

test.cb('filter xss, use getParameters method, in POST', (t) => {
    req.post('/parameters', {
        body: {
            a: '<script>alert("xss")</script>'
        }
    }, (err, res, body) => {
        t.deepEqual(body.data, ['&lt;script&gt;alert("xss")&lt;/script&gt;'])
        t.end()
    })
})

test.cb('no filter xss, use getParameter method, in POST', (t) => {
    req.post('/parameter', {
        body: {
            xss: false,
            a: '<script>alert("xss")</script>'
        }
    }, (err, res, body) => {
        t.is(body.data, '<script>alert("xss")</script>')
        t.end()
    })
})

test.cb('no filter xss, use getParameters method, in POST', (t) => {
    req.post('/parameters', {
        body: {
            xss: false,
            a: '<script>alert("xss")</script>'
        }
    }, (err, res, body) => {
        t.deepEqual(body.data, ['<script>alert("xss")</script>'])
        t.end()
    })
})

test.cb('upload file, use getParameter method, in POST', (t) => {
    req.post('/parameter', {
        formData: {
            a: fs.createReadStream(join(__dirname + '/../package.json'))
        }
    }, (err, res, body) => {
        t.is(body.data.name, 'package.json')
        t.end()
    })
})

test.cb('upload file, use getParameters method, in POST', (t) => {
    req.post('/parameters', {
        formData: {
            a: fs.createReadStream(join(__dirname + '/../package.json'))
        }
    }, (err, res, body) => {
        t.is(body.data[0].name, 'package.json')
        t.end()
    })
})

test.cb('get destruction parameter', (t) => {
    req.get('/destruction_parameter', { qs: { a: { b: 1 } } }, (err, res, body) => {
        t.is(body.data, 1)
        t.end()
    })
})

test.cb('post destruction parameter', (t) => {
    req.post('/destruction_parameter', { body: { a: { b: 1 } } }, (err, res, body) => {
        t.is(body.data, 1)
        t.end()
    })
})

test.cb('get destruction parameter, not b field', (t) => {
    req.post('/destruction_parameter', { body: { a: { c: { b: 1 } } } }, (err, res, body) => {
        t.is(body.data, undefined)
        t.end()
    })
})

test.cb('get default value', (t) => {
    req.get('/default_parameter', (err, res, body) => {
        t.is(body.number, 10)
        t.is(body.string, 'test')
        t.is(body.boolean, false)
        t.is(body.array, 1)
        t.is(JSON.stringify(body.obj), JSON.stringify({ key: 'value' }))
        t.end()
    })
})

test.cb('get multiple default value', (t) => {
    req.get('/default_parameter?multiple=true', (err, res, body) => {
        t.is(JSON.stringify(body.number), JSON.stringify([10]))
        t.is(JSON.stringify(body.string), JSON.stringify(['test']))
        t.is(JSON.stringify(body.boolean), JSON.stringify([false]))
        t.is(JSON.stringify(body.array), JSON.stringify([1, 2, 3]))
        t.is(JSON.stringify(body.obj), JSON.stringify([{ key: 'value' }]))
        t.end()
    })
})