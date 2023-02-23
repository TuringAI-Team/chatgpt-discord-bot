import axios from "axios";
export async function chat(
  image: Buffer,
  question: string,
  username: string,
  id: string
) {
  console.log(process.env.REPLICATE_API_KEY);
  var res = await axios({
    method: "post",
    url: "https://api.replicate.com/v1/predictions",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Token " + process.env.REPLICATE_API_KEY,
    },
    data: {
      version:
        "4b32258c42e9efd4288bb9910bc532a69727f9acd26aa08e175713a0a857a608",
      image: image,
      question: question,
      caption: false,
    },
  });
  var response = res.data;
  console.log(response);
  return response;
}
