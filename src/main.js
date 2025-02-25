const basePath = process.cwd();
const project = process.argv[2]; // 引数でproject指定
const { NETWORK } = require(`${basePath}/constants/network.js`);
const fs = require("fs");
const sha1 = require(`${basePath}/node_modules/sha1`);
const { createCanvas, loadImage } = require(`${basePath}/node_modules/canvas`);
const buildDir = `${basePath}/build-${project}`;
const {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
} = require(`${basePath}/src/config-${project}.js`);
const canvas = createCanvas(format.width, format.height);
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = format.smoothing;
var metadataList = [];
var metadataListPerLayerOrder = []; // LayerOrderごとのmetadataList。rarity.jsで利用する。
var attributesList = [];
var dnaList = new Set();
const DNA_DELIMITER = "--"; // もしtrait名に"--" or "."が入る場合は考慮が必要
const HashlipsGiffer = require(`${basePath}/modules/HashlipsGiffer.js`);

let hashlipsGiffer = null;

const buildSetup = () => {
  if (fs.existsSync(buildDir)) {
    fs.rmdirSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir);
  fs.mkdirSync(`${buildDir}/assets-${project}`);
  for (let i = 0; i < layerConfigurations.length; i++) {
    fs.mkdirSync(`${buildDir}/layerConfig-${i}`);
  }
  if (gif.export) {
    fs.mkdirSync(`${buildDir}/gifs`);
  }
};

const getRarityWeight = (_str) => {
  let nameWithoutExtension = _str.indexOf(".") === -1 ? _str : _str.slice(0, -4);
  var nameWithoutWeight = Number(
    nameWithoutExtension.indexOf(rarityDelimiter) === -1 ? NaN : nameWithoutExtension.split(rarityDelimiter).pop()
  );
  if (isNaN(nameWithoutWeight)) {
    nameWithoutWeight = 1;
  }
  return nameWithoutWeight;
};

const cleanDna = (_str) => {
  const withoutOptions = removeQueryStrings(_str);
  var dna = Number(withoutOptions.split(":").shift());
  return dna;
};

const cleanName = (_str) => {
  let nameWithoutExtension = _str.indexOf(".") === -1 ? _str : _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  return nameWithoutWeight;
};

const getElements = (path) => {
  return fs
    .readdirSync(path)
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
    .map((i, index) => {
      if (i.includes(DNA_DELIMITER)) {
        throw new Error(`layer name can not contain dashes, please fix: ${i}`);
      }
      return {
        id: index,
        name: cleanName(i),
        filename: i,
        path: `${path}${i}`,
        weight: getRarityWeight(i),
      };
    });
};

const layerOptionsSetup = (_layersOrder) => {
  // layerOrder数分layersをセットアップして、layersの選択肢配列を作成する。
  const layerOptions = _layersOrder.map((value) => ({
    weight: value.weight || 1,
    layers: value.layers.map((layerObj, index) => ({
      id: index,
      elements: getElements(`${value.layersDir}/${layerObj.name}/`),
      name: layerObj.options?.["displayName"] != undefined ? layerObj.options?.["displayName"] : layerObj.name,
      blend: layerObj.options?.["blend"] != undefined ? layerObj.options?.["blend"] : "source-over",
      opacity: layerObj.options?.["opacity"] != undefined ? layerObj.options?.["opacity"] : 1,
      bypassDNA: layerObj.options?.["bypassDNA"] !== undefined ? layerObj.options?.["bypassDNA"] : false,
      pairLayers:
        value.pairLayers?.[layerObj.name] &&
        pairLayerValidation(layerObj.name, value.pairLayers[layerObj.name], value.layersDir) &&
        value.pairLayers[layerObj.name],
    })),
  }));
  return layerOptions;
};

// 制約をつけているtraitが存在するかどうか確認
const pairLayerValidation = (_checkLayer, _pairLayers, _layersDir) => {
  for (pairLayer of _pairLayers) {
    // targetTraits存在確認
    checkTraits(pairLayer, "targetTraits", `${_layersDir}/${_checkLayer}`);

    // pairTraits存在確認
    checkTraits(pairLayer, "pairTraits", `${_layersDir}/${pairLayer.pairLayerName}`);

    // excludedTraits存在確認
    checkTraits(pairLayer, "excludedTraits", `${_layersDir}/${pairLayer.pairLayerName}`);
  }
  return true;
};

const checkTraits = (_pairLayer, _checkTraits, _layerPath) => {
  if (!_pairLayer[_checkTraits]) return;

  const elements = getElements(_layerPath);
  for (trait of _pairLayer[_checkTraits]) {
    const element = elements.find((value) => value.name === trait);
    if (!element) {
      throw new Error(`${trait} doesn't exist: ${_layerPath}/${trait}`);
    }
  }
};

const saveImage = (_editionCount) => {
  fs.writeFileSync(`${buildDir}/assets-${project}/${_editionCount}.png`, canvas.toBuffer("image/png"));
};

const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, ${background.brightness})`;
  return pastel;
};

const drawBackground = () => {
  ctx.fillStyle = background.static ? background.default : genColor();
  ctx.fillRect(0, 0, format.width, format.height);
};

const addMetadata = (_dna, _edition, _selectedLayerOptionIndex) => {
  let dateTime = Date.now();
  let tempMetadata = {
    name: `${namePrefix} #${_edition}`,
    description: description,
    image: `${baseUri}/${_edition}.png`,
    dna: sha1(_dna),
    edition: _edition,
    date: dateTime,
    ...extraMetadata,
    attributes: attributesList,
    compiler: "Coinfra Labs",
  };
  if (network == NETWORK.sol) {
    tempMetadata = {
      //Added metadata for solana
      name: tempMetadata.name,
      description: tempMetadata.description,
      image: `${_edition}.png`,
      dna: tempMetadata.dna,
      edition: tempMetadata.edition,
      date: tempMetadata.date,
      ...extraMetadata,
      attributes: tempMetadata.attributes,
      compiler: tempMetadata.compiler,
      external_url: solanaMetadata.external_url,
      properties: {
        files: [
          {
            uri: `${_edition}.png`,
            type: "image/png",
          },
        ],
        category: "image",
      },
    };
  }
  metadataList.push(tempMetadata);
  metadataListPerLayerOrder[_selectedLayerOptionIndex].push(tempMetadata);
  attributesList = [];
};

const addAttributes = (_element) => {
  let selectedElement = _element.layer.selectedElement;
  attributesList.push({
    trait_type: _element.layer.name,
    value: selectedElement.name,
  });
};

const loadLayerImg = async (_layer) => {
  try {
    return new Promise(async (resolve) => {
      const image = await loadImage(`${_layer.selectedElement.path}`);
      resolve({ layer: _layer, loadedImage: image });
    });
  } catch (error) {
    console.error("Error loading image:", error);
  }
};

const addText = (_sig, x, y, size) => {
  ctx.fillStyle = text.color;
  ctx.font = `${text.weight} ${size}pt ${text.family}`;
  ctx.textBaseline = text.baseline;
  ctx.textAlign = text.align;
  ctx.fillText(_sig, x, y);
};

const drawElement = (_renderObject, _index, _layersLen) => {
  ctx.globalAlpha = _renderObject.layer.opacity;
  ctx.globalCompositeOperation = _renderObject.layer.blend;
  text.only
    ? addText(
        `${_renderObject.layer.name}${text.spacer}${_renderObject.layer.selectedElement.name}`,
        text.xGap,
        text.yGap * (_index + 1),
        text.size
      )
    : ctx.drawImage(_renderObject.loadedImage, 0, 0, format.width, format.height);

  addAttributes(_renderObject);
};

const constructLayerToDna = (_dna = "", _layers = []) => {
  let mappedDnaToLayers = _layers.map((layer, index) => {
    let selectedElement = layer.elements.find((e) => e.id == cleanDna(_dna.split(DNA_DELIMITER)[index]));
    return {
      name: layer.name,
      blend: layer.blend,
      opacity: layer.opacity,
      selectedElement: selectedElement,
    };
  });
  return mappedDnaToLayers;
};

/**
 * In some cases a DNA string may contain optional query parameters for options
 * such as bypassing the DNA isUnique check, this function filters out those
 * items without modifying the stored DNA.
 *
 * @param {String} _dna New DNA string
 * @returns new DNA string with any items that should be filtered, removed.
 */
const filterDNAOptions = (_dna) => {
  const dnaItems = _dna.split(DNA_DELIMITER);
  const filteredDNA = dnaItems.filter((element) => {
    const query = /(\?.*$)/;
    const querystring = query.exec(element);
    if (!querystring) {
      return true;
    }
    const options = querystring[1].split("&").reduce((r, setting) => {
      const keyPairs = setting.split("=");
      return { ...r, [keyPairs[0]]: keyPairs[1] };
    }, []);

    return options.bypassDNA;
  });

  return filteredDNA.join(DNA_DELIMITER);
};

/**
 * Cleaning function for DNA strings. When DNA strings include an option, it
 * is added to the filename with a ?setting=value query string. It needs to be
 * removed to properly access the file name before Drawing.
 *
 * @param {String} _dna The entire newDNA string
 * @returns Cleaned DNA string without querystring parameters.
 */
const removeQueryStrings = (_dna) => {
  const query = /(\?.*$)/;
  return _dna.replace(query, "");
};

const isDnaUnique = (_DnaList = new Set(), _dna = "") => {
  const _filteredDNA = filterDNAOptions(_dna);
  return !_DnaList.has(_filteredDNA);
};

const createDna = (_layers, index) => {
  let randNum = [];
  let pairLayerMap = new Map(); // キー: pairLayerのレイヤー名、value: { pairTraits: ペアになるtrait配列, excludedTraits: 除外するtrait配列 } を保持するマップ
  _layers.forEach((layer) => {
    let elements = layer.elements;

    // TODO: robotic swords用のコード 対応終了後に削除
    if (index <= 39 && layer.name === "Wings") {
      elements = elements.filter((element) => element.name === "Acid" || element.name === "Cheetah");
    }

    // pairLayerに該当するか確認し、該当する場合はペアになるtraitsを抽出
    if (pairLayerMap.has(layer.name)) {
      const pairTraits = pairLayerMap.get(layer.name).pairTraits;
      const excludedTraits = pairLayerMap.get(layer.name).excludedTraits;
      elements = elements.filter((element) => {
        return (
          (pairTraits.length > 0 ? pairTraits.includes(element.name) : true) && // pairTraitsが定義されている場合は配列に含まれるtraitsを取得
          (excludedTraits.length > 0 ? !excludedTraits.includes(element.name) : true) // excludedTraitsが定義されている場合は配列に含まれないtraitsを取得
        );
      });
    }

    if (elements.length === 0) {
      console.log("pairLayerMap", pairLayerMap);
      throw new Error(`Can't select trait for ${layer.name}`);
    }

    let totalWeight = 0;
    elements.forEach((element) => {
      totalWeight += element.weight;
    });
    // number between 0 - totalWeight
    let random = Math.floor(Math.random() * totalWeight);
    for (let i = 0; i < elements.length; i++) {
      // subtract the current weight from the random weight until we reach a sub zero value.
      random -= elements[i].weight;
      if (random < 0) {
        // もしpairLayerが存在する場合はpairLayerMapに格納
        if (layer.pairLayers) {
          layer.pairLayers
            .filter(
              (pairLayer) => pairLayer.targetTraits.includes(elements[i].name) // pairLayers指定のあるtraitsかどうか確認
            )
            .forEach((pairLayer) => {
              if (pairLayerMap.has(pairLayer.pairLayerName)) {
                // すでにmap内にpairLayerが存在する場合は、pairTraitsとexcludedTraitsを追加
                const existValue = pairLayerMap.get(pairLayer.pairLayerName);

                // 同じLayerに対して複数のpairTraitsを設定すると矛盾が生じるのでエラーを返す
                if (
                  pairLayer.pairTraits &&
                  existValue.pairTraits.length > 0 &&
                  (existValue.pairTraits.length !== pairLayer.pairTraits.length ||
                    existValue.pairTraits.some((trait) => pairLayer.pairTraits.indexOf(trait) === -1))
                ) {
                  console.log("pairLayerMap", pairLayerMap);
                  throw new Error(
                    `The pairTrait for ${pairLayer.pairLayerName} is duplicated. layer: ${layer.name}, trait: ${elements[i].name}`
                  );
                }

                pairLayerMap.set(pairLayer.pairLayerName, {
                  pairTraits: [...existValue.pairTraits, ...(pairLayer.pairTraits || [])],
                  excludedTraits: [...existValue.excludedTraits, ...(pairLayer.excludedTraits || [])],
                });
              } else {
                // map内にpairLayerが存在しない場合は、pairTraitsとexcludedTraitsを初期化
                pairLayerMap.set(pairLayer.pairLayerName, {
                  pairTraits: pairLayer.pairTraits || [],
                  excludedTraits: pairLayer.excludedTraits || [],
                });
              }
            });
        }

        return randNum.push(`${elements[i].id}:${elements[i].filename}${layer.bypassDNA ? "?bypassDNA=true" : ""}`);
      }
    }
  });
  return randNum.join(DNA_DELIMITER);
};

const writeMetaData = (_data) => {
  fs.writeFileSync(`${buildDir}/_metadata.json`, _data);
};

const saveMetaDataSingleFile = (_editionCount) => {
  let metadata = metadataList.find((meta) => meta.edition == _editionCount);
  debugLogs ? console.log(`Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`) : null;
  fs.writeFileSync(`${buildDir}/assets-${project}/${_editionCount}.json`, JSON.stringify(metadata, null, 2));
};

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

// layerOptionsの中からランダムで一つ選ぶ
function selectlayerOption(_layerOptions) {
  const totalWeight = _layerOptions.reduce((total, layerOption) => total + layerOption.weight, 0);

  // number between 0 - totalWeight
  let selectedLayerOptionIndex;
  let random = Math.floor(Math.random() * totalWeight);
  for (var i = 0; i < _layerOptions.length; i++) {
    // subtract the current weight from the random weight until we reach a sub zero value.
    random -= _layerOptions[i].weight;
    if (random < 0) {
      selectedLayerOptionIndex = i;
      break;
    }
  }

  return {
    layers: _layerOptions[selectedLayerOptionIndex].layers,
    selectedLayerOptionIndex,
  };
}

const startCreating = async () => {
  let layerConfigIndex = 0;
  let editionCount = 1;
  let failedCount = 0;
  let abstractedIndexes = [];
  const firstIndex = network == NETWORK.sol ? 0 : 1;
  const lastIndex =
    network == NETWORK.sol
      ? layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo - 1
      : layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo;
  for (let i = firstIndex; i <= lastIndex; i++) {
    abstractedIndexes.push(i);
  }
  if (shuffleLayerConfigurations) {
    abstractedIndexes = shuffle(abstractedIndexes);
  }
  debugLogs ? console.log("Editions left to create: ", abstractedIndexes) : null;
  while (layerConfigIndex < layerConfigurations.length) {
    const layerOptions = layerOptionsSetup(layerConfigurations[layerConfigIndex].layersOrder);

    metadataListPerLayerOrder = [];
    // layerOptionsの数分空配列で初期化
    for (let i = 0; i < layerOptions.length; i++) {
      metadataListPerLayerOrder[i] = [];
    }

    while (editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo) {
      const { layers, selectedLayerOptionIndex } = selectlayerOption(layerOptions);

      const newDna = createDna(layers, abstractedIndexes[0]);
      if (isDnaUnique(dnaList, newDna) || layerConfigurations[layerConfigIndex].isAllowSameDna) {
        const results = constructLayerToDna(newDna, layers);

        // outputImageSrcLayerが定義されている場合はImageSrcをコピーする
        if (layerConfigurations[layerConfigIndex].outputImageSrcLayer) {
          results.forEach((layer) => {
            addAttributes({ layer });
          });
          const outputImageSrcPath = results.find(
            (result) => result.name === layerConfigurations[layerConfigIndex].outputImageSrcLayer
          ).selectedElement.path;
          fs.copyFileSync(outputImageSrcPath, `${buildDir}/assets-${project}/${abstractedIndexes[0]}.png`);
        } else {
          const loadedElements = [];

          results.forEach((layer) => {
            loadedElements.push(loadLayerImg(layer));
          });
          const renderObjectArray = await Promise.all(loadedElements);
          debugLogs ? console.log("Clearing canvas") : null;
          ctx.clearRect(0, 0, format.width, format.height);
          if (gif.export) {
            hashlipsGiffer = new HashlipsGiffer(
              canvas,
              ctx,
              `${buildDir}/gifs/${abstractedIndexes[0]}.gif`,
              gif.repeat,
              gif.quality,
              gif.delay
            );
            hashlipsGiffer.start();
          }
          // デフォルトではbackground生成は無し。必要な場合はコメントアウトを外す。
          // if (background.generate) {
          //   drawBackground();
          // }
          renderObjectArray.forEach((renderObject, index) => {
            drawElement(renderObject, index, layerConfigurations[layerConfigIndex].layersOrder.length);
            if (gif.export) {
              hashlipsGiffer.add();
            }
          });
          if (gif.export) {
            hashlipsGiffer.stop();
          }
          debugLogs ? console.log("Editions left to create: ", abstractedIndexes) : null;
          saveImage(abstractedIndexes[0]);
        }

        addMetadata(newDna, abstractedIndexes[0], selectedLayerOptionIndex);
        saveMetaDataSingleFile(abstractedIndexes[0]);
        console.log(`Created edition: ${abstractedIndexes[0]}, with DNA: ${sha1(newDna)}, Created: ${editionCount}`);

        dnaList.add(filterDNAOptions(newDna));
        editionCount++;
        abstractedIndexes.shift();
      } else {
        console.log("DNA exists!");
        failedCount++;
        if (failedCount >= uniqueDnaTorrance) {
          console.log(
            `You need more layers or elements to grow your edition to ${layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
          );
          process.exit();
        }
      }
    }

    // layerOptionごとのmetadataを出力
    metadataListPerLayerOrder.forEach((metadataList, index) => {
      fs.writeFileSync(
        `${buildDir}/layerConfig-${layerConfigIndex}/_metadata-${index}.json`,
        JSON.stringify(metadataList, null, 2)
      );
    });

    layerConfigIndex++;
  }
  writeMetaData(JSON.stringify(metadataList, null, 2));
};

module.exports = { startCreating, buildSetup, getElements };
