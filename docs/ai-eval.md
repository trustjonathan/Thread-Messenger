# Thread AI Manual Evaluation Questions

Run these 10 prompts in the Thread AI pane/sheet to verify depth, Markdown formatting, KaTeX math rendering, mode switching, and limits:

1. `what is mitosis` — Expect full concept breakdown: definition, all phases in order, outcome, comparison with meiosis, and a closing curiosity prompt.
2. `solve 2x+3=11` — Expect given/asked restatement, step-by-step aligned algebra in `$$...$$`, result, and a one-line check.
3. `what is 3/4 + 5/6` — Expect LaTeX fractions (`\frac{3}{4}`, `\frac{5}{6}`), common denominator steps, and simplified result without `a/b` in running math.
4. `differentiate x^2 e^x` — Expect product rule stated, step-by-step substitution in LaTeX (`x^{2}`, `e^{x}`), and factored final answer.
5. `hi` — Expect brief, natural greeting with no headings, no lists, and no closing challenge.
6. `short: what is pH` — Expect concise explanation honoring the "short" instruction.
7. `explain photosynthesis step by step` — Expect numbered stages, chemical formulas with `\mathrm` ($\mathrm{CO_2}$, $\mathrm{H_2O}$), and a closing line.
8. `a field is 120 m by 85 m, find its area in hectares` — Expect units in `\text{ }` ($120\ \text{m}$, $85\ \text{m}$, $\text{m}^2$, $\text{ha}$), step-by-step conversion, and sanity check.
9. `solve x^2 - 5x + 6 = 0 using the discriminant` — Expect discriminant formula $\Delta = b^{2} - 4ac$, substitution, two roots, and check.
10. `what is the capital of Uganda` — Expect quick fact (1–3 sentences: Kampala) plus a short offer to go deeper.
