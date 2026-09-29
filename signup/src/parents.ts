import { page } from "./html";

export function parentsPage(): Response {
  return page(
    "A note for parents",
    `
<h1>ESA Students' Minecraft Server: a note for parents</h1>
<p>Your child may have signed up for a Minecraft server for Elstree Screen Arts
students. This note explains what it is and who is behind it.</p>

<h2>What it is</h2>
<ul>
  <li>A private Minecraft world for ESA students, running all the time.</li>
  <li><strong>Not run by the school.</strong> It is run by an ESA student, with help
    from a parent who hosts it at home and keeps an eye on it.</li>
  <li>Survival mode. Players on computers (Java edition) and on phones, tablets,
    Windows PCs and Chromebooks (Bedrock edition) share the same world. Games
    consoles are not supported.</li>
  <li>Free. There is nothing to buy beyond Minecraft itself.</li>
</ul>

<h2>Who can join</h2>
<p>Only students who sign up with their ESA school email and are then added by
hand. Anyone not on the list cannot get in. When signing up, your child ticks a
box to say you know and are OK with it.</p>

<h2>Rules</h2>
<p>Be kind, no griefing (spoiling other people's builds), have fun. Moderators can
remove or ban anyone who breaks the rules. The adult involved talks to students
only in the public chat that everyone can see, never in private messages.</p>

<h2>What is recorded</h2>
<ul>
  <li><strong>Chat and server logs</strong>, including when players join and leave:
    kept for 30 days, and in backups for up to 14 days after that,
    so about 6 weeks at most.</li>
  <li><strong>Every block placed or broken</strong>, with the player's name, so
    damage can be undone. Kept while the world exists.</li>
  <li><strong>Play time</strong> per player, from Minecraft's own statistics.</li>
  <li><strong>Sign-up details</strong> (Minecraft name, school email, form group):
    deleted 30 days after your child is added.</li>
</ul>
<p>Nothing is shared with anyone else, and nothing is used for advertising.</p>

<h2>Microsoft and Xbox family settings</h2>
<p>If your child has a child Microsoft account, you may need to allow "join
multiplayer games" in Microsoft Family Safety before they can play online.</p>

<h2>Questions, or taking your child off</h2>
<p>Email Chris Thompson, the parent who hosts the server, at
<a href="mailto:me@chris-thompson.uk">me@chris-thompson.uk</a>. Ask and your child
will be removed from the server and their sign-up details deleted.</p>

<p><a href="/">Back to the sign-up form</a></p>
`,
  );
}
