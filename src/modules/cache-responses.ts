import fetch from "node-fetch";

async function checkInCache(message, model) {
  console.log("Checking in cache");
  try {
    let res = await fetch(`https://api.turingai.tech/cache/checkcache`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TURING_KEY}`,
      },
      body: JSON.stringify({
        message,
        model,
      }),
    });
    let data = await res.json();
    return { text: data.response.response };
  } catch (e) {
    return null;
  }
}
async function saveInCache(message: string, response, model) {
  console.log("saving in cache");
  let res = await fetch(`https://api.turingai.tech/cache/savecache`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TURING_KEY}`,
    },
    body: JSON.stringify({
      message,
      response,
      model,
    }),
  });
  let data = await res.json();
  return data.success;
}
async function addUsesInCache(message, model) {
  console.log("add uses");

  let res = await fetch(`https://api.turingai.tech/cache/addusescache`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TURING_KEY}`,
    },
    body: JSON.stringify({
      message,
      model,
    }),
  });
  let data = await res.json();
  return data.success;
}

export { checkInCache, saveInCache, addUsesInCache };
