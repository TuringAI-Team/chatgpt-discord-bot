import fetch from "node-fetch";

async function checkInCache(message, model) {
  console.log("Checking in cache");
  let res = await fetch(`https://api.turingai.tech/checkcache`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TURING_API}`,
    },
    body: JSON.stringify({
      message,
      model,
    }),
  });
  let data = await res.json();
  console.log(data);
  return data.response;
}
async function saveInCache(message: string, response, model) {
  console.log("saving in cache");
  let res = await fetch(`https://api.turingai.tech/savecache`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TURING_API}`,
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

  let res = await fetch(`https://api.turingai.tech/addusescache`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TURING_API}`,
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
