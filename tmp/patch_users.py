import re

filepath = 'src/pages/Users.tsx'
content = open(filepath, 'r').read()

# 1. Substituir a exibição do setor principal na tabela de usuários
target1 = '{user.sectorName || <span className="text-muted-foreground italic">Não atribuído</span>}'
replacement1 = """<>
                                  <span>{user.sectorName || <span className="text-muted-foreground italic">Não atribuído</span>}</span>
                                  {user.additionalSectors && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {user.additionalSectors.split(',').map(id => {
                                        const sec = sectors.find(s => s.id === id);
                                        return sec ? <span key={id} className="text-[10px] bg-secondary text-secondary-foreground border border-border px-1.5 py-0.5 rounded font-semibold">{sec.name}</span> : null;
                                      })}
                                    </div>
                                  )}
                                </>"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Substituição 1 aplicada com sucesso!")
else:
    print("Aviso: target1 não encontrado no arquivo!")

# 2. Substituir para adicionar a seção de setores adicionais no formulário
target2 = '                  <div className="flex gap-3 pt-4">'
replacement2 = """                  {formData.role === 'ATTENDANT' && (
                     <div className="space-y-2">
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Setores Adicionais sob Responsabilidade</label>
                        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-secondary/20 rounded-xl border border-border/50">
                           {sectors
                              .filter(s => s.id !== formData.sectorId)
                              .map(s => {
                                 const isChecked = (formData.additionalSectors || '')
                                    .split(',')
                                    .filter(Boolean)
                                    .includes(s.id);
                                 return (
                                    <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/50 rounded-lg cursor-pointer text-xs text-foreground">
                                       <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={e => {
                                             const current = (formData.additionalSectors || '').split(',').filter(Boolean);
                                             let updated;
                                             if (e.target.checked) {
                                                updated = [...current, s.id];
                                             } else {
                                                updated = current.filter(id => id !== s.id);
                                             }
                                             setFormData({ ...formData, additionalSectors: updated.join(',') });
                                          }}
                                          className="rounded text-blue-500 bg-secondary/50 border-border focus:ring-blue-500 w-3.5 h-3.5"
                                       />
                                       <span className="truncate">{s.name}</span>
                                    </label>
                                 );
                              })}
                           {sectors.filter(s => s.id !== formData.sectorId).length === 0 && (
                              <p className="text-xs text-muted-foreground italic p-2 col-span-2">Nenhum outro setor disponível</p>
                           )}
                        </div>
                     </div>
                  )}

                  <div className="flex gap-3 pt-4">"""

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Substituição 2 aplicada com sucesso!")
else:
    # Tenta com espaços diferentes
    content_lines = content.split('\\n')
    found = False
    for i, line in enumerate(content_lines):
        if 'flex gap-3 pt-4' in line and '<div' in line:
            indent = len(line) - len(line.lstrip())
            ind_str = " " * indent
            # Vamos substituir essa linha
            new_replacement = replacement2.replace('                  ', ind_str)
            content_lines[i] = new_replacement
            content = '\\n'.join(content_lines)
            found = True
            print(f"Substituição 2 aplicada dinamicamente na linha {i}!")
            break
    if not found:
        print("Erro: target2 não encontrado!")

open(filepath, 'w').write(content)
print("Salvo com sucesso!")
