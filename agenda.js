// agenda.js
import { Agenda } from 'agenda';
import Auction from './models/auction.js';

const agenda = new Agenda({
  db: { address: process.env.MONGODB_URI, collection: 'agendaJobs' }
});

// Job: Start Auction
agenda.define('start auction', async (job) => {
  const { auctionId } = job.attrs.data;
  const auction = await Auction.findById(auctionId);
  if (!auction || auction.status !== 'Scheduled') return;

  auction.status = 'Active';
  await auction.save();

  console.log(`Auction ${auctionId} started`);

  // Emit notification via Socket.IO if needed
  if (agenda.io) {
    agenda.io.to(auctionId).emit('auctionStarted', {
      auctionId,
      message: 'Auction has started'
    });
  }
});

// Job: End Auction
agenda.define('end auction', async (job) => {
  const { auctionId } = job.attrs.data;
  const auction = await Auction.findById(auctionId);
  if (!auction || auction.status !== 'Active') return;

  auction.status = 'Ended';
  await auction.save();

  console.log(`Auction ${auctionId} ended`);

  // Emit notification via Socket.IO if needed
  if (agenda.io) {
    agenda.io.to(auctionId).emit('auctionEnded', {
      auctionId,
      message: 'Auction has ended'
    });
  }
});

export const initAgenda = async (io) => {
  agenda.io = io; // So we can access Socket.IO inside job handlers
  await agenda.start();
  console.log('Agenda started');
};

export const getAgendaInstance = () => agenda;
