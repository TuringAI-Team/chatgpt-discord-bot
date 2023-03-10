export async function getTranlation(lang: string) {
  let res = await fetch(
    `https://open-assistant.io/locales/${lang}/common.json`
  );
  let json = await res.json();
  let res2 = await fetch(
    `https://open-assistant.io/locales/${lang}/tasks.json`
  );
  let json2 = await res2.json();
  let res3 = await fetch(
    `https://open-assistant.io/locales/${lang}/dashboard.json`
  );
  let json3 = await res3.json();
  let res4 = await fetch(
    `https://open-assistant.io/locales/${lang}/leaderboard.json`
  );
  let json4 = await res4.json();
  let res5 = await fetch(
    `https://open-assistant.io/locales/${lang}/labelling.json`
  );
  let json5 = await res5.json();
  let res6 = await fetch(
    `https://open-assistant.io/locales/${lang}/message.json`
  );
  let json6 = await res6.json();
  let res7 = await fetch(
    `https://open-assistant.io/locales/${lang}/index.json`
  );
  let json7 = await res7.json();
  let translationObject = {
    ...json,
    ...json2,
    ...json3,
    ...json4,
    ...json5,
    ...json6,
    ...json7,
  };
  if (!translationObject["skip"]) {
    let englishTranslation = await getTranlation("en");
    translationObject["skip"] = englishTranslation["skip"];
  }
  return translationObject;
}

let locales = [
  "en",
  "ar",
  "bn",
  "ca",
  "da",
  "de",
  "es",
  "eu",
  "fa",
  "fr",
  "gl",
  "hu",
  "it",
  "ja",
  "ko",
  "pl",
  "pt-BR",
  "ru",
  "uk-UA",
  "vi",
  "zh",
  "th",
  "tr",
  "id",
];
export { locales };

const missingDisplayNamesForLocales = {
  eu: "Euskara",
  gl: "Galego",
};

/**
 * Returns the locale's name.
 */
export const getLocaleDisplayName = (
  locale: string,
  displayLocale = undefined
) => {
  // Intl defaults to English for locales that are not oficially translated
  if (missingDisplayNamesForLocales[locale]) {
    return missingDisplayNamesForLocales[locale];
  }
  const displayName = new Intl.DisplayNames([displayLocale || locale], {
    type: "language",
  }).of(locale);
  // Return the Titlecased version of the language name.
  return displayName.charAt(0).toLocaleUpperCase() + displayName.slice(1);
};
