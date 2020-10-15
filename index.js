require('dotenv').config();
const path = require('path');
const yup = require('yup');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const express = require('express');
const bodyParser = require('body-parser');
const monk = require('monk');
const { nanoid } = require('nanoid');
const app = express();

const db = monk(process.env.MONGODB_URI);
const urls = db.get('urls');
urls.createIndex({ slug: 1 }, { unique: true });

app.use(cors());
app.use(helmet());
app.use(morgan('tiny'));
app.use(bodyParser.json());
app.use(express.static('./public'));

const notFoundPath = path.join(__dirname, 'public/404.html');

const schema = yup.object().shape({
  slug: yup.string().trim().matches(/^[\w\-]+$/i),
  url: yup.string().trim().url().required(),
});

app.get('/:id', async (req, res) => {
  const { id: slug } = req.params;
  try {
    const url = await urls.findOne({ slug });
    console.log(url);
    if (url) {
      return res.redirect(url.url);
    }
    return res.status(404).sendFile(notFoundPath);
  } catch (error) {
    return res.status(404).sendFile(notFoundPath);
  }
});

app.post('/url', async (req, res, next) => {
  let { slug, url } = req.body;
  try {

    await schema.validate({ slug, url });

    if (url.includes('cdv.sh')) {
      throw new Error('Can\'t shorten cdv.sh');
    }

    if (!slug) {
      slug = nanoid(5);
    } else if (await isExisting(slug)) {
      throw new Error('Slug in use. 🍔');
    }

    const newUrl = { slug: slug.toLowerCase(), url };
    const created = await urls.insert(newUrl);

    res.json(created);
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  res.status(404).sendFile(notFoundPath);
});

app.use((error, req, res, next) => {
  if (error.status) {
    res.status(error.status);
  } else {
    res.status(500);
  }
  res.json({
    message: error.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : error.stack,
  });
});


const port = process.env.PORT || 4100;
app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});


isExisting = async (slug) => {
  return await urls.findOne({ slug });
};