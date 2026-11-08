/* Reconhecimento de fala do painel ao vivo.

   O Chrome só reconhece em português com `webkitSpeechRecognition`, e fecha o
   reconhecedor ao fim de alguns segundos de silêncio — por isso o `onend`
   volta a arrancar enquanto o modo está ligado. Resultados provisórios vão
   para a legenda do painel; só as frases fechadas seguem para a sinalizadora.

   Este ficheiro não sabe desenhar sinais: entrega a frase a `aoFrase`. */
(function () {
  'use strict';

  var rec = null;
  var ativo = false;
  var opcoes = null;
  var reinicio = 0;

  function suportado() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function construir() {
    var Motor = window.SpeechRecognition || window.webkitSpeechRecognition;
    rec = new Motor();
    rec.lang = 'pt-PT';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = function (ev) {
      var fechada = '';
      var provisoria = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i];
        var txt = (r[0] && r[0].transcript) || '';
        if (r.isFinal) fechada += txt; else provisoria += txt;
      }
      if (provisoria.trim() && opcoes && opcoes.aoProvisorio) {
        opcoes.aoProvisorio(provisoria.replace(/\s+/g, ' ').trim());
      }
      if (fechada.trim() && opcoes && opcoes.aoFrase) {
        opcoes.aoFrase(fechada.replace(/\s+/g, ' ').trim());
      }
    };

    rec.onerror = function (ev) {
      var erro = (ev && ev.error) || 'desconhecido';
      if (erro === 'no-speech' || erro === 'aborted') return;
      /* sem microfone ou sem permissão não vale a pena insistir */
      var fatal = erro === 'not-allowed' || erro === 'service-not-allowed' || erro === 'audio-capture';
      if (fatal) parar();
      if (opcoes && opcoes.aoErro) opcoes.aoErro(erro, fatal);
    };

    rec.onend = function () {
      if (!ativo) return;
      clearTimeout(reinicio);
      reinicio = setTimeout(function () {
        if (!ativo) return;
        try { rec.start(); } catch (e) { /* já está a correr */ }
      }, 350);
    };
  }

  function iniciar(o) {
    opcoes = o || {};
    if (!suportado()) {
      if (opcoes.aoErro) opcoes.aoErro('sem_suporte', true);
      return false;
    }
    if (!rec) construir();
    ativo = true;
    try { rec.start(); } catch (e) { /* já estava ligado */ }
    return true;
  }

  function parar() {
    ativo = false;
    clearTimeout(reinicio);
    if (rec) { try { rec.stop(); } catch (e) { /* já parado */ } }
  }

  window.AO_VIVO = {
    iniciar: iniciar,
    parar: parar,
    suportado: suportado,
    ligado: function () { return ativo; },
  };
})();
