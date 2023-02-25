import axios from "axios";
import { predict } from "replicate-api";
export async function chat(
  image: Buffer,
  question: string,
  username: string,
  id: string
) {
  const prediction = await predict({
    model: "salesforce/blip-2", // The model name
    input: {
      image: image,
      question: question,
      caption: false,
      use_nucleus_sampling: false,
      context: "",
    }, // The model specific input
    token: process.env.REPLICATE_API_KEY, // You need a token from replicate.com
    poll: true, // Wait for the model to finish
  });

  console.log(prediction);
  if (prediction.error) return prediction;
  return { text: prediction.output };
}
