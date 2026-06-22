// Wraps the substring(s) matching `query` in <mark> — used by the mission workspace's search
// (mission number, rider, BL number, linked BC code) so a dispatcher can see at a glance why a
// given row matched instead of having to re-read the whole line.
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const Highlight = ({ text, query }: { text: string; query: string }) => {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'ig'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export default Highlight;
