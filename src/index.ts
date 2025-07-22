import express from 'express';
import dotenv from 'dotenv';
import { handleEvent } from './labeler';
import { connectDB } from './config/dbconfig';
import { LabelEvent } from './models/LabelEvent'; 

dotenv.config();
//console.log("GitHub Token:", process.env.GITHUB_TOKEN);
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', './src/views');

connectDB();

app.get('/', async (req, res) => {
  const filter: any = {};
  const { label, repo } = req.query;

  if (label) filter.labels = label;
  if (repo) filter.repo = repo;

  try {
    const events = await LabelEvent.find(filter).sort({ time: -1 }).lean();
    res.render('dashboard', { events, label, repo });
    console.log({ events, label, repo });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send('Failed to load dashboard');
  }
});

app.post('/webhook', async (req, res) => {
  try {
    console.log("Incoming event:", req.body.action);
    await handleEvent(req.body);
    res.status(200).send('Event received');
  } catch (err: any) {
    console.error(' Error handling webhook:', err.message);
    res.status(500).send(`Webhook error: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`running on port ${PORT}`);
});
