import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline min-h-[44px] py-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Settings
        </Link>

        <h1 className="text-2xl font-bold tracking-tight">Thread Terms of Use</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          These terms govern your use of Thread, a free, text-only messaging app run by Thread Messenger. Effective date: Tuesday/24/November/2026.
        </p>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-base font-semibold">1. Agreeing to these terms and who can use Thread</h2>
          <p>By signing in or using Thread you accept these terms and our Privacy Policy. If you do not accept them, do not use Thread.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must be at least 18 years old and able to make a binding agreement under the law where you live.</li>
            <li>You may not use Thread if we have suspended or removed your account, unless we have allowed you back.</li>
            <li>If you use Thread on behalf of an organisation, you confirm you may accept these terms for it.</li>
          </ul>

          <h2 className="text-base font-semibold">2. Your account and username</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You sign in with a Google account. Keep it secure. You are responsible for what happens on your Thread account.</li>
            <li>You choose your username once. It cannot be changed later. It must be 3 to 30 characters: lowercase letters, numbers and underscore.</li>
            <li>Some usernames are reserved. We may change or remove a username that is misleading, offensive or impersonates someone.</li>
            <li>One account per person. Give accurate information, and do not use a name or username to pretend to be someone else.</li>
            <li>If you think someone else has access to your account, contact us at trustheth777@gmail.com.</li>
          </ul>

          <h2 className="text-base font-semibold">3. How you may use Thread</h2>
          <p>Be respectful. You agree not to use Thread to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Harass, bully, threaten, stalk or intimidate anyone.</li>
            <li>Send hateful content that attacks people for their race, ethnicity, religion, gender, sexual orientation, disability or similar traits.</li>
            <li>Share sexual content involving a minor, or anything that exploits or endangers children. We have zero tolerance and will report it to the authorities.</li>
            <li>Send unwanted sexual messages or sexually harass anyone.</li>
            <li>Spam, send mass or repeated unwanted messages, advertise without permission, run scams, or trick people into sending money or personal details.</li>
            <li>Share malware, phishing links or anything meant to harm devices or steal data.</li>
            <li>Pretend to be another person, an organisation or Thread staff.</li>
            <li>Publish someone's private information without their consent.</li>
            <li>Encourage or plan violence, self-harm or crime.</li>
            <li>Break any law that applies to you.</li>
            <li>Try to get into other accounts or messages, probe or attack the service, get around limits, blocking or reporting, collect lists of users, or use bots or automated tools to create accounts or send messages without our permission.</li>
          </ul>
          <p>Thread is for text only. Do not try to send files, images or other media.</p>

          <h2 className="text-base font-semibold">4. Your messages</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You own what you write. You give us a limited, non-exclusive permission to store, process and deliver your messages to the people you send them to, and to review them where needed for a report, for safety or because the law requires it.</li>
            <li>You are responsible for what you send. Anyone you message can copy, screenshot or share it, and we cannot prevent that.</li>
            <li>We do not sell your messages and do not use them for advertising.</li>
            <li>To ask us to delete your account and messages, contact us at trusteth777@gmail.com. The Privacy Policy explains what we keep.</li>
          </ul>

          <h2 className="text-base font-semibold">5. Reporting, blocking and moderation</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Block. You can block anyone. A blocked person cannot message you, and we do not tell them they are blocked.</li>
            <li>Report. You can report a message or a person. We may keep a copy of the reported message and related details so we can review it, even if the sender later deletes it.</li>
            <li>Our actions. We may remove content, limit features, or suspend or end accounts that break these terms or put others at risk, with or without notice.</li>
            <li>No promise to watch. We do not routinely read messages and we cannot promise to review every report within a set time.</li>
            <li>Authorities. We may share information with the authorities where the law requires it or to protect someone's safety.</li>
            <li>Emergencies. Thread is not an emergency service. If someone is in danger, contact your local emergency services.</li>
          </ul>

          <h2 className="text-base font-semibold">6. Messages are not end-to-end encrypted</h2>
          <p>Messages travel over secure connections, but they are stored on our servers and are not end-to-end encrypted. This means we and our service providers can technically access them. Do not send passwords, bank details or other highly sensitive information.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>We use Google for sign-in, Supabase for our database and Render for hosting. Their outages or incidents can affect Thread, and their own terms apply to their services.</li>
            <li>We take reasonable steps to protect Thread, but no system is completely secure.</li>
            <li>If a data breach affects you, we will tell the people and authorities the law requires us to tell.</li>
          </ul>

          <h2 className="text-base font-semibold">7. The service: free beta, changes and availability</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Thread is free and still being built. Features can change, be added or be removed.</li>
            <li>Thread may be slow, unavailable or lose data. Our free hosting may pause the service after a period of inactivity. Keep your own copy of anything important.</li>
            <li>We may set limits, for example on how fast you can send messages, and may change them to keep Thread fair and working.</li>
            <li>We do not promise to keep Thread running. If we stop, we will give notice where we reasonably can.</li>
            <li>Messages can contain links. We do not control other websites and are not responsible for them.</li>
            <li>Thread's source code may be shared under its own licence. These terms apply to the hosted service, not the code licence.</li>
          </ul>

          <h2 className="text-base font-semibold">8. Ending your account</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You can stop using Thread at any time. To have your account deleted, contact us at trusteth777@gmail.com. We aim to act within 7 days, subject to the law and to keeping records needed for safety, such as reports.</li>
            <li>We may suspend or end your account if you break these terms, if you put others at risk, if the law requires it, or if we close Thread.</li>
            <li>Messages already delivered to other people may stay on their side.</li>
            <li>Sections that by their nature should continue, such as your responsibility for what you sent, the disclaimers, the limits of liability and the governing law, continue after your account ends.</li>
          </ul>

          <h2 className="text-base font-semibold">9. Disclaimers and limits of liability</h2>
          <p>To the extent the law allows:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Thread is provided "as is" and "as available", without promises that it will be error-free, secure, always available or fit for a particular purpose.</li>
            <li>We are not responsible for what other users send or do, for messages or data lost, or for access to your account that we could not reasonably prevent.</li>
            <li>We are not liable for indirect or consequential losses. Our total liability for any claim is limited to what you paid us to use Thread, which is nothing because Thread is free.</li>
            <li>You are responsible for claims, losses and costs that result from your breach of these terms or from what you send.</li>
          </ul>
          <p>Nothing in these terms removes rights or liability that the law does not allow us to remove.</p>

          <h2 className="text-base font-semibold">10. Governing law, changes to the terms and contact</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Law. These terms are governed by the laws of the Republic of Uganda, and the courts of Uganda can hear disputes, unless a mandatory rule where you live says otherwise. Please contact us first so we can try to settle a problem informally.</li>
            <li>Changes. We may update these terms. We will post the new version with its date and, for important changes, tell you in the app. If you keep using Thread after a change, you accept it. If you do not accept it, stop using Thread.</li>
            <li>The rest. If part of these terms cannot be enforced, the rest still applies. If we delay enforcing a term, we do not give it up.</li>
            <li>Contact. Thread Messenger, trusteth777@gmail.com, Kabale district, UGANDA.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}