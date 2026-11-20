# ABISS demo — Interactive Evaluation of Text-to-SQL Agents on Ambiguous and Unanswerable Questions

This repository holds the demonstration of [ABISS](https://github.com/giosullutrone/ABISS-Evaluating-Text-to-SQL-Systems-Through-Agent-Interaction) for the ICDE 2027 demonstrations track. ABISS builds a Text-to-SQL benchmark from a relational database and evaluates Text-to-SQL systems in dialogues with a simulated user. It covers answerable, ambiguous and unanswerable questions.

The demonstration is a web application with an overview and three screens:

| Key | Screen | What it shows |
|---|---|---|
| `0` | Overview | the three steps of ABISS, the taxonomy of questions, the databases |
| `1` | Generate & Validate | a candidate question written by an LLM, and the ten validation stages that keep or remove it, with the votes of the council |
| `2` | Benchmarking | the dialogue between a system under test and the simulated user, and what happens behind the simulated user |
| `3` | Four Modes | the same question and system in the four category modes, side by side |
| `4` | Paper Results | results reported in the ABISS paper |

The three screens share one selection: collection (BIRD or Spider), database, subcategory, style, difficulty and question. You make it by clicking the parts of the sentence at the top of each screen.

Video of the demonstration: https://youtu.be/pYGKCgZD5nE

## Run it

You need Node.js 20 or later.

```bash
cd demo-gui
npm ci
npm run dev        # http://localhost:5173
```

Other commands:

```bash
npm run build      # static build in demo-gui/dist/, with the data copied into dist/data/
npm run preview    # serves the build at http://localhost:4173
npm test
npm run lint
```

The application needs no GPU and no network connection: the fonts are bundled.

### Controls

- **Presentation mode**: press `P`, or open with `?present=1`. Text is larger, `→` and `←` move one step, and `0`–`4` change screen.
- **Bottom bar**: restart, step back, play or pause, step forward, speed `1×` or `4×`.
- **Reset demo** (bottom left): back to the default question.

## Data

All content shown by the interface (questions, SQL, votes, dialogues, results) is read from `demo_data/`; the code contains no example text and no numbers.

```
demo_data/
  abiss_demo_data.json                          taxonomy, models, validation stages, database schemas,
                                                index of all candidate questions, overview texts, results
  questions/<collection>/<database>/<subcategory>.json   each candidate question with its validation, stage by stage
  dialogues/<collection>/<database>/<subcategory>.json   the dialogues of the benchmark
```

The data cover:
- the 11 BIRD (dev) databases and 11 company-related Spider databases used in the ABISS paper;
- all 10,296 candidate questions, accepted or rejected;
- the 24,648 dialogues of three systems under test, each in the four category modes, on the balanced evaluation subsets of the paper. The three systems are GPT-OSS-120B, Qwen3.5-122B-A10B-FP8 and NVIDIA-Nemotron-3-Super-120B-A12B-FP8.

The main JSON is loaded at start; the detail files are loaded one at a time, when a database and a subcategory are chosen. Every file is checked against a schema (`demo-gui/src/data/schema.ts`). If a field is wrong, the interface names the field instead of showing a blank page.

## Citation

```bibtex
@inproceedings{sullutrone2027abiss,
  title     = {{ABISS}: Evaluating Text-to-{SQL} Systems Through Agent Interaction},
  author    = {Sullutrone, Giovanni and Sala, Luca and Aftar, Sania and Koutrika, Georgia and Bergamaschi, Sonia},
  booktitle = {Findings of the Association for Computational Linguistics: EACL 2027},
  year      = {2027},
  note      = {To appear. arXiv:2607.23340}
}
```
