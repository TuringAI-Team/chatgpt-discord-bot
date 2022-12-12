import delay from "delay";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

/**
 * Bypasses OpenAI's use of Cloudflare to get the cookies required to use
 * ChatGPT. Uses Puppeteer with a stealth plugin under the hood.
 */
export async function getOpenAIAuthInfo({
  email,
  password,
  timeout = 2 * 60 * 1000,
  browser,
}) {
  let page;
  let origBrowser = browser;

  try {
    if (!browser) {
      browser = await getBrowser();
    }

    const userAgent = await browser.userAgent();
    page = (await browser.pages())[0] || (await browser.newPage());
    page.setDefaultTimeout(timeout);

    await page.goto("https://chat.openai.com/auth/login");
    await page.waitForSelector("#__next .btn-primary", { timeout });
    await delay(1000);

    if (email && password) {
      await Promise.all([
        page.click("#__next .btn-primary"),
        page.waitForNavigation({
          waitUntil: "networkidle0",
        }),
      ]);
      await page.type("#username", email, { delay: 10 });
      await page.click('button[type="submit"]');
      await page.waitForSelector("#password");
      await page.type("#password", password, { delay: 10 });
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({
          waitUntil: "networkidle0",
        }),
      ]);
    }

    const pageCookies = await page.cookies();
    const cookies = pageCookies.reduce(
      (map, cookie) => ({ ...map, [cookie.name]: cookie }),
      {}
    );

    const authInfo = {
      userAgent,
      clearanceToken: cookies["cf_clearance"]?.value,
      sessionToken: cookies["__Secure-next-auth.session-token"]?.value,
      cookies,
    };

    return authInfo;
  } catch (err) {
    console.error(err);
    throw null;
  } finally {
    if (origBrowser) {
      if (page) {
        await page.close();
      }
    } else if (browser) {
      await browser.close();
    }

    page = null;
    browser = null;
  }
}

export async function getBrowser(launchOptions) {
  //const macChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

  return puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--exclude-switches", "enable-automation"],
    ignoreHTTPSErrors: true,
    executablePath: process.env.BROWSER_PATH,
    ...launchOptions,
  });
}
