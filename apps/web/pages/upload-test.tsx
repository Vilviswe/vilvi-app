import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Bucket = 'profile-public' | 'adult-private' | 'chat-temp';

export default function UploadTest18Plus() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>('profile-public');
  const [visibility, setVisibility] = useState<'public'|'members'|'private'>('private');
  const [category, setCategory] = useState<'profile'|'post'|'chat'|'adult'>('post');
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string>('');

  const logLine = (s: string) => setLog(prev => s + '\n' + prev);

  async function signIn() {
    setLog('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { logLine('Logga in: ' + error.message); return; }
    setSessionUserId(data.user?.id ?? null);
    logLine('Inloggad som ' + data.user?.id);
    // Gör dig själv admin/adult i DB om inte redan (vi har seedat tidigare)
  }

  function detectKind(mime: string): 'image'|'video'|'audio'|'gif'|'other' {
    if (mime.startsWith('image/')) return mime === 'image/gif' ? 'gif' : 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'other';
  }

  async function doUpload() {
    if (!sessionUserId) { logLine('Inte inloggad.'); return; }
    if (!file) { logLine('Välj en fil.'); return; }

    // Regler: adult-private -> adult_only=true, category='adult'
    const isAdultBucket = bucket === 'adult-private';
    const adultOnly = isAdultBucket;
    const finalCategory = isAdultBucket ? 'adult' : category;

    // Konstruera path: <userId>/<timestamp>-<filnamn>
    const safeName = file.name.replace(/\s+/g, '_');
    const storagePath = `${sessionUserId}/${Date.now()}-${safeName}`;

    // 1) Ladda upp till Storage (RLS gör jobbet)
    const { data: up, error: upErr } = await supabase
      .storage
      .from(bucket)
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (upErr) { logLine('Upload fel: ' + upErr.message); return; }
    logLine(`Upload OK: ${up?.path}`);

    // 2) Skriv rad till media_files (pending moderation)
    const kind = detectKind(file.type);
    const { data: ins, error: insErr } = await supabase
      .from('media_files')
      .insert({
        user_id: sessionUserId,
        storage_bucket: bucket,
        storage_path: storagePath,
        kind,
        mime_type: file.type || null,
        size_bytes: file.size,
        visibility,
        category: finalCategory,
        is_sensitive: adultOnly,  // vuxet innehåll markeras känsligt
        adult_only: adultOnly,
        moderation: 'pending',    // går in i kön
      })
      .select('id')
      .single();

    if (insErr) { logLine('Insert media_files fel: ' + insErr.message); return; }
    logLine('media_files id: ' + ins?.id);
  }

  return (
    <div style={{maxWidth: 720, margin: '32px auto', fontFamily: 'system-ui, sans-serif'}}>
      <h1>Upload-test (18+)</h1>

      <fieldset style={{border:'1px solid #ddd', padding:12, marginBottom:16}}>
        <legend>Logga in (Supabase Auth)</legend>
        <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',marginBottom:8}} />
        <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',marginBottom:8}} />
        <button onClick={signIn}>Logga in</button>
        {sessionUserId && <div style={{marginTop:8}}>User ID: <code>{sessionUserId}</code></div>}
      </fieldset>

      <fieldset style={{border:'1px solid #ddd', padding:12, marginBottom:16}}>
        <legend>Val</legend>
        <label>
          Bucket:&nbsp;
          <select value={bucket} onChange={e=>setBucket(e.target.value as Bucket)}>
            <option value="profile-public">profile-public (publikt + moderation)</option>
            <option value="adult-private">adult-private (18+ privat, kräver is_adult)</option>
            <option value="chat-temp">chat-temp (privat, kö)</option>
          </select>
        </label>
        <br />
        <label>
          Visibility:&nbsp;
          <select value={visibility} onChange={e=>setVisibility(e.target.value as any)}>
            <option value="private">private</option>
            <option value="members">members</option>
            <option value="public">public</option>
          </select>
        </label>
        <br />
        <label>
          Category:&nbsp;
          <select value={category} onChange={e=>setCategory(e.target.value as any)} disabled={bucket === 'adult-private'}>
            <option value="profile">profile</option>
            <option value="post">post</option>
            <option value="chat">chat</option>
            <option value="adult">adult (endast för adult-private)</option>
          </select>
        </label>
        <br />
        <input type="file" onChange={e=>setFile(e.target.files?.[0] ?? null)} style={{marginTop:8}} />
        <div style={{marginTop:8}}>
          <button onClick={doUpload}>Ladda upp</button>
        </div>
      </fieldset>

      <pre style={{whiteSpace:'pre-wrap', background:'#f6f6f6', padding:12, border:'1px solid #eee'}}>{log}</pre>
    </div>
  );
}
