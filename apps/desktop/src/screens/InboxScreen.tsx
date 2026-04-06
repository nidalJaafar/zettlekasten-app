import type { Database } from '@zettelkasten/core'
interface Props { db: Database; onCountChange: (n: number) => void }
export default function InboxScreen(_: Props) { return <div>Inbox</div> }
