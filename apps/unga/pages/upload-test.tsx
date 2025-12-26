import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Bucket = 'profile-public' | 'chat-temp';

export default function UploadTestUnga() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>('profile-public');
  const [visibility, setVisibility] = useState<'public'|'private'>('private');
  const [category, setCategory] = useState<'profile'|'post'|'chat'>('post');
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string>('');

  const logLine = (s: string) => setLog(prev => s + '\n' + prev);

  async function signIn() {
    setLog('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { logLine('Logga in: ' + error.message); return; }
    setSessionUserId(data.user?.id ?? null);
    logLine('Inloggad som ' + data.user?.id);
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

    const safeName = file.name.replace(/\s+/g, '_');
    const storagePath = `${sessionUserId}/${Date.now()}-${safeName}`;

    const { data: up, error: upErr } = await supabase
      .storage
      .from(bucket)
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (upErr) { logLine('Upload fel: ' + upErr.message); return; }
    logLine(`Upload OK: ${up?.path}`);

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
        category,
        is_sensitive: false,
        adult_only: false,     // spärras även av constraint
        moderation: 'pending', // går in i kön
      })
      .select('id')
      .single();

    if (insErr) { logLine('Insert media_files fel: ' + insErr.message); return; }
    logLine('media_files id: ' + ins?.id);
  }

  return (
    <div style={{maxWidth: 720, margin: '32px auto', fontFamily: 'system-ui, sans-serif'}}>
      <h1>Upload-test (Unga)</h1>

      <fieldset style={{border:'1px solid #ddd', padding:12, marginBottom:16}}>
        <legend>Logga in</legend>
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
            <option value="profile-public">profile-public</option>
            <option value="chat-temp">chat-temp</option>
          </select>
        </label>
        <br />
        <label>
          Visibility:&nbsp;
          <select value={visibility} onChange={e=>setVisibility(e.target.value as any)}>
            <option value="private">private</option>
            <option value="public">public</option>
          </select>
        </label>
        <br />
        <label>
          Category:&nbsp;
          <select value={category} onChange={e=>setCategory(e.target.value as any)}>
            <option value="profile">profile</option>
            <option value="post">post</option>
            <option value="chat">chat</option>
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
