
How did LTB start?

Parser tooling is very fun.  It is also very hard.  I love Indian Carnatic Music.  I had been working on (very partially) on a music notation editor for
carnatic music for several years and finally got serious during the COVID lockdown.   You can checkout the editor here[Notations.Appspot].  

What does this have to do with parser tools?  As you can see from the Notation editor, I needed a document format for storing musical scores.  I did not want to invent a new scheme and wanted existing syntax as much as possible.  So I had settled on using markdown with inline code blocks for storing notationl elements that would be rendered (in a side-by-side editor fashion).

This was the original version (the "v3" syntax) and was reasonably good in bringing up scores for viewing.  However the editor experience was horrendous:

1. Though markdown was standard - music notation editors were not web designers.  For them even workdown and inline code blocks "looked like code".
2. Secondly even after investigating several editors (ToastUI, ACE) there was not a single editor that offered a bugfree, incremental parse tree updater
for the markdown as the user was editing the document. As a result the documented would have to be completely reparsed on every change which completely
slowed down the editing experience.

For addressing (1) a new syntax was introduced - The "Inverted" Markdown.   Essentially  since the notation (or paragraphs) were the hero elements of our editor, what if we could make all presentation elements be "escaped" out.  This also had the benefit of being able to offer a more locked down and formal syntax that did not suffer from Markdown's excessively liberal syntax that made parsing un-reasonable and complext.

(2) - Was the genesis for LTB.  As I started investigating how we could bring better error handling and recovering during editing and incremental parsing I noticed there were very few tools/libraries to help in this area.  The most amazing tool at the time was (and is) TreeSitter!   Absolute respect for the TreeSitter team for an amazing library.   What I wanted though was a playground where I could apply new scanning, parsing, error recovery ideas as they were being introduced and discovered (eg the amazing work by Laurance Tratt and Lukas Diekmann).  So LTB was born to scratch my own long time itch (to build better compiler front ends) while also applying to applications I was passionate about.    Let a thousand languages bloom!
