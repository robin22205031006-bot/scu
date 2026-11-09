CREATE POLICY "vault files read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vault' AND (owner = auth.uid() OR public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.vault_documents d WHERE d.file_path = objects.name AND d.is_public AND d.downloadable)));
CREATE POLICY "vault staff insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vault' AND public.is_staff(auth.uid()));
CREATE POLICY "vault staff update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'vault' AND public.is_staff(auth.uid()));
CREATE POLICY "vault staff delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vault' AND public.is_staff(auth.uid()));