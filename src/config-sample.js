const basePath = process.cwd();
const { MODE } = require(`${basePath}/constants/blend_mode.js`);
const { NETWORK } = require(`${basePath}/constants/network.js`);

const network = NETWORK.sol;
const baseUri = "ipfs://NewUriToReplace";

///// ↓修正必要箇所↓ /////
const namePrefix = "Your Collection"; // NFT名の「〇〇 #15」の〇〇の部分
const description = "Remember to replace this description"; // プロジェクト概要

const solanaMetadata = {
  external_url: "https://www.coinfra.io", // NFTに付与したいサイトのURLがあれば記載
};

const layerConfigurations = [
  {
    growEditionSizeTo: 10,
    layersOrder: [
      {
        layersDir: `${basePath}/layers`, // layerが入っているフォルダパス
        weight: 1, // このlayerOrderの出現率の重さ
        pairLayers: {
          // 特定のlayerでtraitを制限したい場合は以下のように指定する。処理順番の関係上、自分よりも下の階層になるlayerは指定することができない。
          Eyeball: [
            {
              targetTraits: ["Red"], // 対象となるtrait名
              pairLayerName: "Iris", // 制限したいtraitがあるlayer名
              pairTraits: ["Small", "Medium"], // ペアとなるtrait名
            },
          ],
          "Eye color": [
            {
              // 以下のように除外したいtraitも選ぶことができる
              targetTraits: ["Yellow", "Red"], // 対象となるtrait名
              pairLayerName: "Top lid", // 制限したいtraitがあるlayer名
              excludedTraits: ["Middle"], // 除外したいtrait名
            },
          ],
        },
        layers: [
          { name: "Background" },
          { name: "Eyeball" },
          { name: "Eye color" },
          { name: "Iris" },
          { name: "Shine" },
          { name: "Bottom lid" },
          { name: "Top lid" },
        ],
      },
      {
        layersDir: `${basePath}/layers`,
        weight: 2,
        layers: [
          { name: "Background" },
          { name: "Eyeball" },
          { name: "Eye color" },
          { name: "Iris" },
          { name: "Shine" },
          { name: "Bottom lid" },
          { name: "Top lid" },
        ],
      },
    ],
  },
  {
    growEditionSizeTo: 15,
    isAllowSameDna: true, // 同じDNAを許容するかのフラグ
    outputImageSrcLayer: "Eyeball", // 全てのNFTで出力画像が同じ場合は、画像ソースのLayer名を入力
    layersOrder: [
      {
        layersDir: `${basePath}/layers`,
        layers: [
          { name: "Background" },
          { name: "Eyeball" },
          { name: "Eye color" },
          { name: "Iris" },
          { name: "Shine" },
          { name: "Bottom lid" },
          { name: "Top lid" },
        ],
      },
    ],
  },
];

const format = {
  // 元画像の大きさに合わせて修正
  width: 512,
  height: 512,
  smoothing: false, // ピクセルアートの場合に利用する <参考>https://developer.mozilla.org/ja/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled
};

const shuffleLayerConfigurations = true; // layerConfigurationsが複数ある場合それらのindexをシャッフルするかのフラグ
///// ↑修正必要箇所↑ /////

const debugLogs = false;

const gif = {
  export: false,
  repeat: 0,
  quality: 100,
  delay: 500,
};

const text = {
  only: false,
  color: "#ffffff",
  size: 20,
  xGap: 40,
  yGap: 40,
  align: "left",
  baseline: "top",
  weight: "regular",
  family: "Courier",
  spacer: " => ",
};

const pixelFormat = {
  ratio: 2 / 128,
};

const background = {
  generate: true,
  brightness: "80%",
  static: false,
  default: "#000000",
};

const extraMetadata = {};

const rarityDelimiter = "#";

const uniqueDnaTorrance = 10000;

const preview = {
  thumbPerRow: 5,
  thumbWidth: 50,
  imageRatio: format.height / format.width,
  imageName: "preview.png",
};

const preview_gif = {
  numberOfImages: 5,
  order: "ASC", // ASC, DESC, MIXED
  repeat: 0,
  quality: 100,
  delay: 500,
  imageName: "preview.gif",
};

module.exports = {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  preview,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  pixelFormat,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
  preview_gif,
};
