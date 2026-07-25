#!/usr/bin/env python3
"""Auto-tag every question with cross-cutting concept tags (so the same theme
can be reviewed across chapters). Tags are derived from keyword matches in the
question + answer + knowledge-point title. Re-runnable: overwrites `tags`."""
import glob, json, pathlib, re, sys
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
ROOT = pathlib.Path(__file__).resolve().parent.parent

# tag -> trigger substrings (lowercase). Ordered specific → general; capped per Q.
TAGS = [
 ("Softmax", ["softmax"]),
 ("Sigmoid", ["sigmoid"]),
 ("ReLU", ["relu"]),
 ("Tanh", ["tanh"]),
 ("Activation functions", ["activation function", "leaky", "non-linearity", "non-linear activation"]),
 ("Vanishing gradient", ["vanishing gradient", "dead relu", "dead zone", "saturat"]),
 ("Exploding gradient", ["exploding gradient", "gradient clipping"]),
 ("Backpropagation", ["backprop", "upstream", "dout", "chain rule", "gradient w.r.t", "compute the gradient"]),
 ("Jacobian", ["jacobian"]),
 ("Batch normalization", ["batch norm", "batchnorm", "batch-norm"]),
 ("Dropout", ["dropout"]),
 ("Regularization", ["regulariz", "weight decay", "early stopping"]),
 ("L1/L2", ["l1 ", "l2 ", "l1/l2", "l2 regular", "l1 regular", "weight decay"]),
 ("Overfitting", ["overfit", "underfit", "generalization gap"]),
 ("Optimizers", ["optimizer", "rmsprop", "gradient descent", " sgd", "sgd ", "newton"]),
 ("Adam", ["adam"]),
 ("Momentum", ["momentum"]),
 ("Learning rate", ["learning rate"]),
 ("Weight initialization", ["initializ", "xavier", "kaiming", "he init"]),
 ("Receptive field", ["receptive field"]),
 ("Pooling", ["pooling", "maxpool", "max-pool", "max pool", "average pool", "avg pool"]),
 ("1×1 convolution", ["1x1", "1×1", "1 × 1", "pointwise"]),
 ("Convolution", ["convolution", "conv layer", "kernel size", "stride", "padding", "conv1", "filter"]),
 ("CNN", ["cnn", "convolutional neural"]),
 ("Fully-connected", ["fully-connected", "fully connected", "affine layer", "fc layer"]),
 ("RNN", ["rnn", "recurrent"]),
 ("LSTM", ["lstm"]),
 ("Transformer", ["transformer"]),
 ("Attention", ["attention", "self-attention", "query", " keys ", "queries"]),
 ("Positional encoding", ["positional encoding"]),
 ("Autoencoder", ["autoencoder"]),
 ("VAE", ["vae", "variational", "reparameter", "kl diverg"]),
 ("GAN", ["gan ", "generator", "discriminator", "adversarial"]),
 ("U-Net", ["u-net", "unet"]),
 ("ResNet / skip connections", ["resnet", "residual", "skip connection", "highway"]),
 ("Classic architectures", ["lenet", "alexnet", "vggnet", " vgg", "googlenet", "inception"]),
 ("Upsampling", ["upsampl", "transposed conv", "transpose conv", "interpolation", "unpool"]),
 ("Data augmentation", ["augmentation"]),
 ("Normalization", ["normaliz", "standardiz"]),
 ("Dataset splits", ["train/val", "train, validation", "validation set", "test set", "split your dataset", "split the dataset", "three splits"]),
 ("Data leakage", ["leak"]),
 ("Dataloader", ["dataloader", "getitem", "__len__", "batching"]),
 ("Class imbalance", ["imbalance", "oversample", "undersample", "class weight", "minority"]),
 ("Loss functions", ["loss function", "cross-entropy", "cross entropy", " bce", " cce", " mse", " mae", "l2 loss", "l1 loss"]),
 ("Transfer learning", ["transfer learning", "pre-trained", "pretrained", "fine-tune", "finetune", "backbone", "freeze"]),
 ("Supervised vs unsupervised", ["supervised", "unsupervised"]),
 ("Clustering / PCA", ["k-means", "kmeans", "clustering", " pca", "dimensionality reduction"]),
 ("Regression", ["regression"]),
 ("Parameter counting", ["how many parameters", "number of parameters", "learnable parameters", "trainable parameters", "parameter count"]),
 ("i.i.d. / distribution", ["i.i.d", "distribution mismatch", "domain gap", "same distribution", "distribution shift"]),
]
MAX_TAGS = 5

def tags_for(text):
    t = text.lower()
    out = []
    for name, kws in TAGS:
        if any(k in t for k in kws):
            out.append(name)
        if len(out) >= MAX_TAGS:
            break
    return out

def main():
    total = 0
    for f in glob.glob(str(ROOT / "data" / "ch*.json")):
        p = pathlib.Path(f)
        if p.name == "chapters.json":
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        for kp in data["knowledge_points"]:
            blob = kp["title"]  # KP title only; recap is too broad and over-tags
            for q in kp["questions"]:
                opt = " ".join(o["text"] for o in q.get("options", []))
                text = " ".join([q["q"], q.get("answer", ""), q.get("extend", ""), opt, blob])
                q["tags"] = tags_for(text)
                total += len(q["tags"])
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"tagged {p.name}")
    print(f"assigned {total} tags")

if __name__ == "__main__":
    main()
