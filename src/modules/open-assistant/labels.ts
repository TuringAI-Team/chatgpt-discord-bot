export async function getLabel(translation, previousTask: string, task) {
  var labels = await getLabels(task);
  if (previousTask) {
    var previousTaskIndex = labels.findIndex(
      (x) => x.name == previousTask.replaceAll("-", "_")
    );
  } else {
    var previousTaskIndex = -1;
  }

  var label = labels[previousTaskIndex + 1];
  if (!label) return;
  var resultTask: {
    name: string;
    type: string;
    question?: string;
    description?: string;
    max?: string;
    min?: string;
  } = {
    name: label.name,
    type: label.type,
    ...labelText(label, translation),
  };

  return resultTask;
}

export function labelText(label, translation) {
  var resultTask: {
    question?: string;
    description?: string;
    max?: string;
    min?: string;
  } = {};
  if (label.name == "spam") {
    resultTask.question = translation["spam.question"];
    resultTask.description = `${translation["spam.one_desc.line_1"]}\n${translation["spam.one_desc.line_2"]}`;
  } else if (label.name == "fails_task") {
    resultTask.question = translation["fails_task.question"];
    resultTask.description = `${translation["fails_task.one_desc"]}`;
  } else if (label.name == "lang_mismatch") {
    resultTask.question = `${translation["lang_mismatch"]}`;
  } else if (label.name == "not_appropriate") {
    resultTask.question = `${translation["inappropriate.one_desc"]}`;
  } else if (label.name == "pii") {
    resultTask.question = `${translation["pii"]}`;
    resultTask.description = `${translation["pii.explanation"]}`;
  } else if (label.name == "hate_speech") {
    resultTask.question = `${translation["hate_speech"]}`;
    resultTask.description = `${translation["hate_speech.explanation"]}`;
  } else if (label.name == "sexual_content") {
    resultTask.question = `${translation["sexual_content"]}`;
    resultTask.description = `${translation["sexual_content.explanation"]}`;
  } else if (label.name == "quality") {
    resultTask.max = `${translation["high_quality"]}`;
    resultTask.min = `${translation["low_quality"]}`;
  } else if (label.name == "helpfulness") {
    resultTask.max = `${translation["helpful"]}`;
    resultTask.min = `${translation["unhelpful"]}`;
  } else if (label.name == "creativity") {
    resultTask.max = `${translation["creative"]}`;
    resultTask.min = `${translation["ordinary"]}`;
  } else if (label.name == "humor") {
    resultTask.max = `${translation["humorous"]}`;
    resultTask.min = `${translation["serious"]}`;
  } else if (label.name == "toxicity") {
    resultTask.max = `${translation["polite"]}`;
    resultTask.min = `${translation["rude"]}`;
  } else if (label.name == "violence") {
    resultTask.max = `${translation["harmless"]}`;
    resultTask.min = `${translation["violent"]}`;
  }
  return resultTask;
}

export async function getLabels(task) {
  var labels = [];
  for (var i = 0; i < task.valid_labels.length; i++) {
    var type = "flags";
    if (
      task.valid_labels[i] == "quality" ||
      task.valid_labels[i] == "toxicity" ||
      task.valid_labels[i] == "humor" ||
      task.valid_labels[i] == "helpfulness" ||
      task.valid_labels[i] == "creativity" ||
      task.valid_labels[i] == "violence"
    ) {
      type = "number";
    }
    if (task.valid_labels[i] == "spam" || task.valid_labels[i] == "fails_task")
      type = "yes/now";

    labels.push({
      name: task.valid_labels[i],
      type: type,
    });
  }
  return labels;
}

export function formatLabel(label: string) {
  if (label == "yes") {
    return 1;
  } else if (label == "no") {
    return 0;
  } else if (label == "skip") {
    return 0;
  } else if (label == "1") {
    return 0.0;
  } else if (label == "2") {
    return 0.25;
  } else if (label == "3") {
    return 0.5;
  } else if (label == "4") {
    return 0.75;
  } else if (label == "5") {
    return 1.0;
  } else {
    return parseInt(label);
  }
}
