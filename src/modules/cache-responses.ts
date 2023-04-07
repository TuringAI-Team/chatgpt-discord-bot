import redisClient from "./redis.js";
async function checkInCache(message, model) {
  /*  let wordCount = message.split(" ").length;
  if (wordCount <= 1) {
    return {};
  }*/
  let responses = await redisClient.get(model);
  if (responses) {
    responses = JSON.parse(responses);
    if (responses[message]) {
      return responses[message];
    } else {
      return {};
    }
  }
  return {};
}
async function saveInCache(message: string, response, model) {
  let responses: any = await redisClient.get(model);
  if (responses) {
    responses = JSON.parse(responses);
    responses[message] = { text: response, uses: 1 };
  } else {
    responses = { [message]: { text: response, uses: 1 } };
  }
  await redisClient.set(model, JSON.stringify(responses));
}
async function addUsesInCache(message, model) {
  let responses: any = await redisClient.get(model);
  if (responses) {
    responses = JSON.parse(responses);
    if (responses[message]) {
      responses[message].uses += 1;
    }
  }
  await redisClient.set(model, JSON.stringify(responses));
}

export { checkInCache, saveInCache, addUsesInCache };
