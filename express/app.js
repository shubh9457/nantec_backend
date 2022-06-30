const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const uuid = require('uuid').v4;
const serverless = require('serverless-http');

const application = express();

const MONGO_URI = `mongodb+srv://${process.env.USERNAME}:${process.env.PASSWORD}@${process.env.MONGO_CLUSTER}/${process.env.DB_NAME}?retryWrites=true&w=majority`;

mongoose.connect(MONGO_URI, (err) => {
    if (err) {
        throw err;
    }
    console.info('MongoDB connected');
});

const postsModel = mongoose.model("posts", new mongoose.Schema({
    id: {
        type: String,
        required: true,
        immutable: true,
        index: true
    },
    title: {
        type: String
    },
    body: {
        type: String
    },
    pictures: {
        type: Object
    }
}))

/*
application.listen(4000, (err) => {
    if (err) {
        throw err;
    }
    console.info('Server listening on port 4000');
});
*/

application.use(cors());
application.use(bodyParser.json({
    extended: true
}));
app.use('/.netlify/functions/server', application);  // path must route to lambda

application.get('/posts', async (req, res, next) => {
    const [start, end] = JSON.parse(req.query.range);
    if (start > end) {
        return res.status(400).send({
            customCode: 'BAD_REQUEST'
        });
    }
    const rawFilterCondition = JSON.parse(req.query.filter);
    const [sortBy, sortOrder] = JSON.parse(req.query.sort);

    const parsedConditions = {}

    for (let [key, value] of Object.entries(rawFilterCondition)) {
        if (Array.isArray(value)) {
            parsedConditions[key] = {
                $in: value
            }
        } else {
            parsedConditions[key] = {
                $eq: value
            }
        }
    }

    const posts = await postsModel.find(parsedConditions).skip(start).limit(end - start + 1).sort({[`${sortBy}`]: sortOrder.toLowerCase()});
    const length = await postsModel.count(parsedConditions);

    if (!posts.length) {
        posts = [{id: "dummy", title: "dummy", body: "dummy"}];
        length = 1;
    }

    return res.set({
        'Content-Range': `posts=${Math.min(start, length)}-${Math.min(end, length)}/${length}`,
        'Access-Control-Expose-Headers': 'Content-Range'
    }).send(posts || []);
});

application.get('/posts/:id', async (req, res, next) => {
    const post = await postsModel.findOne({id: req.params.id});
    return res.send(post || {});
});

application.post('/posts', async (req, res, next) => {
    const post = {
        id: uuid(),
        ...req.body
    }
    const creation = await postsModel.create(post);
    return res.status(201).send(creation);
});

application.put('/posts/:id', async (req, res, next) => {
    const updateDocument = await postsModel.findOneAndUpdate({id: req.params.id}, req.body);

    return res.send(updateDocument);
});

application.delete('/posts/:id', async (req, res, next) => {
    const deletedDocument = await postsModel.findOneAndDelete({id: req.params.id}, req.body);

    return res.send(deletedDocument);
});

module.exports = app;
module.exports.handler = serverless(application);
