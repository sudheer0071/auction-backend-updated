import AuctionQA from "../models/auctionQA.js";

export const askQuestion = async (req, res) => {
  try {
    const { auctionId, question } = req.body;
    const qa = new AuctionQA({
      auction: auctionId,
      askedBy: req.user.userId,
      question
    });
    await qa.save();
    res.status(201).json({ message: "Question submitted", qa });
  } catch (err) {
    res.status(500).json({ message: "Failed to submit question", error: err.message });
  }
};

export const answerQuestion = async (req, res) => {
  try {
    const { qaId } = req.params;
    const { answer } = req.body;
    const qa = await AuctionQA.findById(qaId);
    if (!qa) return res.status(404).json({ message: "Q&A not found" });
    qa.answer = answer;
    qa.answeredBy = req.user.userId;
    qa.answeredAt = new Date();
    await qa.save();
    res.json({ message: "Answer submitted", qa });
  } catch (err) {
    res.status(500).json({ message: "Failed to submit answer", error: err.message });
  }
};

export const getAuctionQA = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const qas = await AuctionQA.find({ auction: auctionId });
    res.json(qas);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch Q&A", error: err.message });
  }
}; 