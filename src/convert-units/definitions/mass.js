var metric
    , imperial;

metric = {
  elephant: {
    name: {
      singular: "elephant",
      plural: "elephants"
    },
    to_anchor: 3991613
  },
  giraffe: {
    name: {
      singular: "giraffe",
      plural: "giraffes"
    },
    to_anchor: 800000
  },
  polarBear: {
    name: {
      singular: "polar bear",
      plural: "polar bears"
    },
    to_anchor: 680000
  },
  grandPiano: {
    name: {
      singular: "grand piano",
      plural: "grand pianos"
    },
    to_anchor: 450000
  },
  horse: {
    name: {
      singular: "horse",
      plural: "horses"
    },
    to_anchor: 380000
  },
  lion: {
    name: {
      singular: "lion",
      plural: "lions"
    },
    to_anchor: 175000
  },
  panda: {
    name: {
      singular: "panda",
      plural: "pandas"
    },
    to_anchor: 118000
  },
  kangaroo: {
    name: {
      singular: "kangaroo",
      plural: "kangaroos"
    },
    to_anchor: 85000
  },
  chimpanzee: {
    name: {
      singular: "chimpanzee",
      plural: "chimpanzees"
    },
    to_anchor: 45000
  },
  toilet: {
    name: {
      singular: "toilet",
      plural: "toilets"
    },
    to_anchor: 43600
  },
  koala: {
    name: {
      singular: "koala",
      plural: "koalas"
    },
    to_anchor: 9000
  },
  cat: {
    name: {
      singular: "cat",
      plural: "cats"
    },
    to_anchor: 5000
  },
  bowlingBall: {
    name: {
      singular: "bowling ball",
      plural: "bowling balls"
    },
    to_anchor: 5000
  },
  baby: {
    name: {
      singular: "baby",
      plural: "babies"
    },
    to_anchor: 3500
  },
  humanBrain: {
    name: {
      singular: "human brain",
      plural: "human brains"
    },
    to_anchor: 3500
  },
  basketball: {
    name: {
      singular: "basketball",
      plural: "basketballs"
    },
    to_anchor: 620
  },
  apple: {
    name: {
      singular: "apple",
      plural: "apples"
    },
    to_anchor: 70
  },
  g: {
    name: {
      singular: 'Gram',
      plural: 'Grams'
    },
    to_anchor: 1
  },
  kg: {
    name: {
      singular: 'Kilogram',
      plural: 'Kilograms'
    },
    to_anchor: 1000
  },
};

imperial = {
  lb: {
    name: {
      singular: 'Pound'
      , plural: 'Pounds'
    }
    , to_anchor: 1
  }
};

module.exports = {
  metric: metric
  , imperial: imperial
  , _anchors: {
    metric: {
      unit: 'g'
      , ratio: 1 / 453.592
    }
    , imperial: {
      unit: 'lb'
      , ratio: 453.592
    }
  }
};
