const puppeteer = require('puppeteer');
const XLSX = require('xlsx');

(async () => {
  // Inicia o navegador
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const baseUrl = 'https://store.playstation.com/pt-br/category/e6f7738d-39e7-4737-a77d-35bfb43fee9c/';
  let allGames = [];

  // Função para rolar a página até o final
  async function autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  // Função para acessar a página e extrair os links dos jogos
  async function extractGameLinks(page, pageUrl) {
    console.log(`Acessando página: ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 0 });

    await page.waitForSelector('.psw-product-tile__details', { timeout: 300000 });
    await autoScroll(page);

    return await page.evaluate(() => {
      const elements = document.querySelectorAll('a.psw-link.psw-content-link');
      return Array.from(elements).map(el => el.href);
    });
  }

  // Função para extrair os dados de um jogo
  async function extractGameData(gamePage) {
    await gamePage.waitForSelector('.psw-t-title-l', { timeout: 300000 });

    await gamePage.waitForFunction(() => {
      const priceElement = document.querySelector('[data-qa="mfeCtaMain#offer0#finalPrice"]');
      return priceElement && priceElement.innerText.trim() !== '';
    }, { timeout: 300000 });

    return await gamePage.evaluate(() => {
      const nameElement = document.querySelector('.psw-t-title-l');
      const name = nameElement ? nameElement.innerText.trim() : 'Nome não encontrado';

      const priceElement = document.querySelector('[data-qa="mfeCtaMain#offer0#finalPrice"]');
      const price = priceElement ? priceElement.innerText.trim() : 'Preço não encontrado';

      return { name, price };
    });
  }

  // Função para limpar o preço
  function cleanPrice(price) {
    return price.replace('R$', '').trim();
  }

  // Função principal para extrair dados dos jogos
  async function scrapeGames() {
    for (let i = 1; i <= 10; i++) {
      const pageUrl = `${baseUrl}${i}`;

      const gameLinks = await extractGameLinks(page, pageUrl);

      for (const link of gameLinks) {
        const gamePage = await browser.newPage();

        try {
          await gamePage.goto(link, { waitUntil: 'domcontentloaded', timeout: 0 });
          const gameData = await extractGameData(gamePage);

          // Limpa o preço
          gameData.price = cleanPrice(gameData.price);

          // Adiciona os dados do jogo ao array total
          allGames.push(gameData);
          console.log(`Jogo adicionado: ${gameData.name} - ${gameData.price}`);

        } catch (error) {
          console.error(`Erro ao acessar o link do jogo: ${link}.`, error);
        } finally {
          await gamePage.close(); // Fecha a página após capturar os dados
        }
      }
    }
  }

  // Função para salvar os dados em um arquivo Excel
  function saveToExcel(data) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Jogos');
    const filePath = './jogos_psn.xlsx';
    XLSX.writeFile(wb, filePath);
    console.log(`Planilha salva em ${filePath}`);
  }

  // Executa a coleta de dados e salva no Excel
  await scrapeGames();
  saveToExcel(allGames);

  // Fecha o navegador
  await browser.close();
})();
